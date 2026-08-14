/**
 * Endpoint de contacto (Vercel Serverless Function, runtime Node).
 * Envia el formulario del sitio por correo usando Resend.
 *
 * Metodos:
 *   GET   emite un token firmado con el instante de carga del formulario
 *   POST  recibe el formulario, lo filtra por anti-spam y lo envia
 *
 * Anti-spam invisible (sin captcha, sin interaccion del usuario):
 *   1. Honeypot: campos senuelo ocultos que un humano nunca llena.
 *   2. Control de tiempo: el token GET va firmado con HMAC, asi el instante
 *      de carga lo fija el servidor y el bot no puede falsificarlo. Un envio
 *      en menos de MIN_FILL_MS se descarta.
 *   En ambos casos se responde 200 {ok:true} para que el bot crea que tuvo
 *   exito y no reintente por otra via.
 *
 * Variables de entorno:
 *   RESEND_API_KEY      obligatoria para enviar
 *   CONTACT_TO_EMAIL    destinatario  (default info@internetderespaldo.com)
 *   CONTACT_FROM_EMAIL  remitente, direccion simple o "Nombre <addr>"
 *   FORM_TOKEN_SECRET   secreto para firmar el token de tiempo
 */

const { createHmac, timingSafeEqual } = require('node:crypto');

/** Tiempo minimo verosimil para que un humano llene el formulario. */
const MIN_FILL_MS = 3_000;
/** Vigencia del token; pasado esto el cliente pide uno nuevo. */
const MAX_TOKEN_AGE_MS = 2 * 60 * 60 * 1000;

/** Campos trampa. Si cualquiera trae contenido, el envio es de un bot. */
const HONEYPOT_FIELDS = ['website', 'website_url', 'company_address'];

/**
 * Secreto de firma. Si no hay ninguno configurado devuelve null y la
 * verificacion de tiempo se omite (solo deberia pasar en local).
 */
function signingSecret() {
  return process.env.FORM_TOKEN_SECRET || process.env.RESEND_API_KEY || null;
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(String(value)).digest('hex').slice(0, 32);
}

/** Token con el instante de emision: "v1.<ms>.<firma>". */
function issueToken(secret) {
  const issuedAt = Date.now();
  return `v1.${issuedAt}.${sign(issuedAt, secret)}`;
}

/**
 * Devuelve los milisegundos transcurridos desde que se emitio el token,
 * o null si el token falta, esta mal formado, tiene firma invalida o expiro.
 */
function tokenAgeMs(token, secret) {
  if (typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;

  const issuedAt = Number(parts[1]);
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return null;

  const expected = Buffer.from(sign(issuedAt, secret));
  const received = Buffer.from(String(parts[2]));
  if (expected.length !== received.length) return null;
  if (!timingSafeEqual(expected, received)) return null;

  const age = Date.now() - issuedAt;
  // negativo = token del futuro (reloj manipulado); fuera de rango = expirado
  if (age < 0 || age > MAX_TOKEN_AGE_MS) return null;

  return age;
}

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const clean = (s, max) => String(s || '').trim().slice(0, max);

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = await new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => {
      d += c;
      if (d.length > 100_000) reject(new Error('payload too large'));
    });
    req.on('end', () => resolve(d));
    req.on('error', reject);
  });
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  const secret = signingSecret();

  // El cliente pide un token al cargar el formulario.
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    if (!secret) return res.status(200).json({ ok: true, token: null });
    return res.status(200).json({ ok: true, token: issueToken(secret) });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const data = await readBody(req);
  if (!data) return res.status(400).json({ ok: false, error: 'JSON invalido' });

  // --- Anti-spam 1: honeypot -------------------------------------------
  // Un humano nunca ve estos campos. Respondemos ok para que el bot lo de
  // por enviado y no reintente.
  const trampaLlena = HONEYPOT_FIELDS.some(
    (campo) => String(data[campo] || '').trim() !== ''
  );
  if (trampaLlena) {
    console.warn('[contacto] descartado por honeypot');
    return res.status(200).json({ ok: true });
  }

  // --- Anti-spam 2: control de tiempo minimo ---------------------------
  // Sin secreto configurado no podemos verificar nada; lo avisamos y
  // seguimos en vez de bloquear envios legitimos.
  if (!secret) {
    console.warn('[contacto] sin FORM_TOKEN_SECRET; verificacion de tiempo omitida');
  } else {
    const edad = tokenAgeMs(data.token, secret);
    if (edad === null || edad < MIN_FILL_MS) {
      console.warn(
        '[contacto] descartado por tiempo:',
        edad === null ? 'token ausente o invalido' : `${edad}ms`
      );
      return res.status(200).json({ ok: true });
    }
  }

  const nombre = clean(data.nombre, 120);
  const empresa = clean(data.empresa, 200);
  const email = clean(data.email, 200);
  const telefono = clean(data.telefono, 60);
  const servicio = clean(data.servicio, 80);
  const ciudad = clean(data.ciudad, 120);
  const mensaje = clean(data.mensaje, 5000);

  if (!nombre || !empresa || !email || !telefono) {
    return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Correo invalido' });
  }

  const to = process.env.CONTACT_TO_EMAIL || 'info@internetderespaldo.com';
  const fromRaw = process.env.CONTACT_FROM_EMAIL || 'no-reply@resend.nextventures.mx';
  const from = fromRaw.includes('<') ? fromRaw : `Internet de Respaldo <${fromRaw}>`;

  const html = `
    <h2>Nueva solicitud desde el sitio</h2>
    <table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px">
      <tr><td><b>Nombre</b></td><td>${esc(nombre)}</td></tr>
      <tr><td><b>Empresa</b></td><td>${esc(empresa)}</td></tr>
      <tr><td><b>Correo</b></td><td>${esc(email)}</td></tr>
      <tr><td><b>Teléfono</b></td><td>${esc(telefono)}</td></tr>
      <tr><td><b>Servicio</b></td><td>${esc(servicio) || '—'}</td></tr>
      <tr><td><b>Ciudad</b></td><td>${esc(ciudad) || '—'}</td></tr>
      <tr><td valign="top"><b>Mensaje</b></td><td>${esc(mensaje).replace(/\n/g, '<br/>') || '—'}</td></tr>
    </table>
  `;

  if (!process.env.RESEND_API_KEY) {
    console.log('[contacto] falta RESEND_API_KEY; no se envio:', { to, email, empresa });
    return res.status(200).json({ ok: true, dev: true });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `Solicitud web — ${empresa} (${nombre})`,
        html,
      }),
    });

    if (!r.ok) {
      console.error('[contacto] Resend error:', r.status, await r.text());
      return res.status(502).json({ ok: false, error: 'No se pudo enviar el mensaje' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contacto] error inesperado:', err);
    return res.status(500).json({ ok: false, error: 'Error inesperado' });
  }
};
