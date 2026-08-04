/**
 * Conecta el formulario de contacto (compilado en el bundle de React) con
 * /api/contacto.
 *
 * Se engancha en la fase de captura y NO llama preventDefault, de modo que
 * React sigue mostrando su propio estado de "enviado". Si el envio falla,
 * agregamos un aviso visible para no dejar un exito falso.
 *
 * Nota: esto es un parche sobre el build. Si algun dia se recompila el sitio
 * desde el fuente, conviene mover esta llamada al componente Contacto.tsx.
 */
(function () {
  'use strict';

  var ENDPOINT = '/api/contacto';
  var FIELDS = ['nombre', 'empresa', 'email', 'telefono', 'servicio', 'ciudad', 'mensaje', 'website'];

  function collect(form) {
    var out = {};
    FIELDS.forEach(function (name) {
      var el = form.elements[name];
      if (el && typeof el.value === 'string') out[name] = el.value;
    });
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
      })
      .catch(function () {
        showError(form);
      });
  }

  document.addEventListener(
    'submit',
    function (e) {
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      // el formulario de contacto es el unico con estos campos
      if (!form.elements || !form.elements.nombre || !form.elements.email) return;
      send(form);
    },
    true // captura: corre antes del handler de React
  );
})();
