/**
 * Conecta el formulario de contacto (compilado en el bundle de React) con
 * /api/contacto y aplica la proteccion anti-spam invisible del lado cliente.
 *
 * Se engancha en la fase de captura y NO llama preventDefault, de modo que
 * React sigue mostrando su propio estado de "enviado". Si el envio falla,
 * agregamos un aviso visible para no dejar un exito falso.
 *
 * Anti-spam (sin captcha, sin interaccion del usuario):
 *   1. Honeypot: inyectamos campos senuelo ocultos dentro del <form>. Como el
 *      formulario lo renderiza React, no podemos escribirlos en index.html;
 *      se inyectan aqui y se revisan antes de cada envio por si React
 *      remonto el nodo.
 *   2. Control de tiempo: al cargar pedimos por GET un token firmado por el
 *      servidor. El instante de emision lo fija el backend, asi que el bot no
 *      puede falsificarlo. El token se renueva solo para que una pestana
 *      abierta mucho tiempo no pierda el envio.
 *
 * Nota: esto es un parche sobre el build. Si algun dia se recompila el sitio
 * desde el fuente, conviene mover esta llamada al componente Contacto.tsx.
 */
(function () {
  'use strict';

  var ENDPOINT = '/api/contacto';
  var FIELDS = ['nombre', 'empresa', 'email', 'telefono', 'servicio', 'ciudad', 'mensaje'];

  /** Campos trampa; deben coincidir con HONEYPOT_FIELDS de api/contacto.js. */
  var HONEYPOT_FIELDS = ['website', 'website_url', 'company_address'];

  /** Renovamos el token antes de que expire (el backend lo acepta 2 horas). */
  var TOKEN_REFRESH_MS = 20 * 60 * 1000;

  var token = null;

  // --- Token de tiempo -------------------------------------------------

  function fetchToken() {
    return fetch(ENDPOINT, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && typeof data.token === 'string') token = data.token;
      })
      .catch(function () {
        // sin token el backend descarta el envio; reintentamos en la
        // siguiente renovacion en vez de romper el formulario
        token = null;
      });
  }

  // --- Honeypot --------------------------------------------------------

  /**
   * Oculta el campo sin usar display:none ni visibility:hidden: algunos bots
   * detectan justamente esas dos propiedades y se saltan el campo.
   */
  var HIDE_CSS = [
    'position:absolute',
    'left:-9999px',
    'top:auto',
    'width:1px',
    'height:1px',
    'overflow:hidden',
    'opacity:0',
    'pointer-events:none',
  ].join(';');

  function buildHoneypot(name) {
    var wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = HIDE_CSS;

    var label = document.createElement('label');
    label.setAttribute('for', 'hp-' + name);
    label.textContent = 'No llenes este campo';

    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'hp-' + name;
    input.name = name;
    input.value = '';
    input.tabIndex = -1; // fuera del recorrido con Tab
    input.autocomplete = 'off'; // el navegador no lo autocompleta
    input.setAttribute('aria-hidden', 'true');

    wrap.appendChild(label);
    wrap.appendChild(input);
    return wrap;
  }

  /** Inyecta los campos trampa que falten. Idempotente. */
  function ensureHoneypots(form) {
    HONEYPOT_FIELDS.forEach(function (name) {
      if (form.elements[name]) return;
      form.appendChild(buildHoneypot(name));
    });
  }

  /** Busca el formulario de contacto en el DOM (lo monta React). */
  function findForm() {
    var forms = document.getElementsByTagName('form');
    for (var i = 0; i < forms.length; i++) {
      if (forms[i].elements && forms[i].elements.nombre && forms[i].elements.email) {
        return forms[i];
      }
    }
    return null;
  }

  // --- Envio -----------------------------------------------------------

  function collect(form) {
    var out = {};
    FIELDS.concat(HONEYPOT_FIELDS).forEach(function (name) {
      var el = form.elements[name];
      if (el && typeof el.value === 'string') out[name] = el.value;
    });
    if (token) out.token = token;
    return out;
  }

  function showError(form) {
    var id = 'contact-form-error';
    if (document.getElementById(id)) return;
    var p = document.createElement('p');
    p.id = id;
    p.setAttribute('role', 'alert');
    p.textContent =
      'No pudimos enviar tu mensaje. Escríbenos a info@internetderespaldo.com o inténtalo de nuevo.';
    p.style.cssText = 'margin-top:12px;color:#f87171;font-size:14px;font-weight:500';
    (form.parentNode || form).appendChild(p);
  }

  function send(form) {
    var payload = collect(form);
    if (!payload.nombre || !payload.email) return; // el navegador ya valida required

    var old = document.getElementById('contact-form-error');
    if (old) old.remove();

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().catch(function () {
          return { ok: false };
        });
      })
      .then(function (data) {
        if (!data || !data.ok) showError(form);
        // el token es de un solo uso practico: pedimos otro para un
        // eventual segundo envio en la misma visita
        fetchToken();
      })
      .catch(function () {
        showError(form);
      });
  }

  // --- Arranque --------------------------------------------------------

  function init() {
    fetchToken();
    setInterval(fetchToken, TOKEN_REFRESH_MS);

    // React puede montar el formulario despues de este script
    var form = findForm();
    if (form) ensureHoneypots(form);

    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(function () {
        var f = findForm();
        if (f) ensureHoneypots(f);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener(
    'submit',
    function (e) {
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      // el formulario de contacto es el unico con estos campos
      if (!form.elements || !form.elements.nombre || !form.elements.email) return;
      ensureHoneypots(form); // por si React remonto el formulario
      send(form);
    },
    true // captura: corre antes del handler de React
  );
})();
