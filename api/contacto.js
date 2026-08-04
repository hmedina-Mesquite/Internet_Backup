/**
 * Endpoint de contacto (Vercel Serverless Function, runtime Node).
 * Envia el formulario del sitio por correo usando Resend.
 *
 * Variables de entorno:
 *   RESEND_API_KEY      obligatoria para enviar
 *   CONTACT_TO_EMAIL    destinatario  (default info@internetderespaldo.com)
 *   CONTACT_FROM_EMAIL  remitente, direccion simple o "Nombre <addr>"
 */

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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const data = await readBody(req);
  if (!data) return res.status(400).json({ ok: false, error: 'JSON invalido' });

  // honeypot: respondemos ok para que el bot no reintente
  if (data.website) return res.status(200).json({ ok: true });

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
