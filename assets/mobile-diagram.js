/**
 * Reemplazo mobile del diagrama de "Asi funciona tu respaldo".
 *
 * El original usa GSAP ScrollTrigger con pin+scrub y clases "lg:*" que solo
 * aplican desde 1024px: en mobile el pin no tiene track donde correr y los 3
 * estados terminan encimados o apilados sin control (ver mobile-fixes.css).
 *
 * En escritorio el diagrama original se queda igual (con su scroll). Aqui,
 * para mobile, se muestran los 3 pasos apilados como tarjetas numeradas: se
 * ve la misma progresion (fibra activa -> falla detectada -> respaldo activo)
 * y toda la informacion queda visible al mismo tiempo, sin depender de
 * scroll, de GSAP ni de temporizadores, asi que no hay nada que pueda
 * quedarse pegado ni perderse.
 *
 * No consume variables de entorno.
 */
(function () {
  'use strict';

  var STEPS = [
    {
      titulo: 'Operacion normal',
      fibra: { cls: 'node-active', badge: 'Activa', badgeCls: 'badge-green' },
      micro: { cls: 'node-standby', badge: 'Standby', badgeCls: 'badge-cyan' },
      linkCls: 'link-active',
      stats: [
        { texto: '100 Mbps velocidad fibra', cls: 'badge-green' },
        { texto: '50 Mbps velocidad respaldo', cls: 'badge-cyan' }
      ],
      nota: 'Tu fibra principal atiende toda la conexion y el respaldo espera listo en segundo plano.'
    },
    {
      titulo: 'Se cae la fibra',
      fibra: { cls: 'node-danger', badge: 'Sin conexion', badgeCls: 'badge-danger' },
      micro: { cls: 'node-standby', badge: 'Standby', badgeCls: 'badge-cyan' },
      linkCls: 'link-down',
      stats: [],
      nota: 'Caida detectada automaticamente en segundos, sin intervencion manual.'
    },
    {
      titulo: 'Respaldo activo',
      fibra: { cls: 'node-danger', badge: 'Caida', badgeCls: 'badge-danger' },
      micro: { cls: 'node-active', badge: 'Activo', badgeCls: 'badge-green' },
      linkCls: 'link-active',
      stats: [
        { texto: '50 Mbps velocidad respaldo', cls: 'badge-green' }
      ],
      nota: 'Conexion restaurada en menos de 30 segundos.'
    }
  ];

  function esc(valor) {
    return String(valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function nodoHtml(rol, etiqueta, estado) {
    return (
      '<div class="node-group">' +
        '<div class="node ' + esc(estado.cls) + '">' + esc(etiqueta) + '</div>' +
        '<span class="' + esc(estado.badgeCls) + '" style="font-size:10px">' +
          esc(estado.badge) +
        '</span>' +
      '</div>'
    );
  }

  function pasoHtml(paso, numero) {
    var stats = '';
    if (paso.stats.length) {
      stats = '<div class="stats-row">';
      for (var i = 0; i < paso.stats.length; i++) {
        stats +=
          '<span class="' + esc(paso.stats[i].cls) + '" style="font-size:12px">' +
            esc(paso.stats[i].texto) +
          '</span>';
      }
      stats += '</div>';
    }

    return (
      '<li class="step">' +
        '<div class="step-head">' +
          '<span class="step-num">' + numero + '</span>' +
          '<span class="step-title">' + esc(paso.titulo) + '</span>' +
        '</div>' +
        '<div class="step-diagram">' +
          nodoHtml('fibra', 'FIBRA PRINCIPAL', paso.fibra) +
          '<div class="connector ' + esc(paso.linkCls) + '"></div>' +
          '<div class="node node-active">TU EMPRESA</div>' +
          '<div class="connector ' + esc(paso.linkCls) + '"></div>' +
          nodoHtml('micro', 'MICROONDAS RESPALDO', paso.micro) +
        '</div>' +
        stats +
        '<p class="step-note">' + esc(paso.nota) + '</p>' +
      '</li>'
    );
  }

  function build() {
    var section = document.getElementById('como-funciona');
    if (!section || section.querySelector('.mobile-diagram-fallback')) {
      return false;
    }
    var original = section.querySelector('.min-h-\\[400px\\]');
    if (!original || !original.parentNode) {
      return false;
    }

    var pasos = '';
    for (var i = 0; i < STEPS.length; i++) {
      pasos += pasoHtml(STEPS[i], i + 1);
    }

    var wrap = document.createElement('div');
    wrap.className = 'mobile-diagram-fallback';
    wrap.innerHTML =
      '<ol class="steps">' + pasos + '</ol>' +
      '<a href="#/contacto" class="btn-primary">Proteger mi empresa</a>';

    original.parentNode.insertBefore(wrap, original.nextSibling);
    return true;
  }

  function init() {
    if (build()) {
      return;
    }
    // React puede montar la seccion despues de este script
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(function () {
        if (build()) {
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
