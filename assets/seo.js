/*
 * seo.js - Metadatos por ruta para la SPA de BackupNet
 *
 * Que hace:
 *   El sitio es una SPA (React precompilado) servida siempre desde index.html,
 *   por lo que todas las rutas comparten <title>, description y canonical.
 *   Este script ajusta, en cada cambio de ruta, la etiqueta <link rel="canonical">
 *   (apuntando a la URL propia y normalizada de la pagina), el <title>, la
 *   meta description y las etiquetas Open Graph / Twitter.
 *
 * Como se ejecuta:
 *   Cargado con <script src="./assets/seo.js" defer> desde index.html.
 *   Se engancha a pushState / replaceState / popstate y tambien al primer render.
 *   No usa preventDefault ni toca el DOM del bundle de React.
 *
 * Variables de entorno: ninguna (es codigo de cliente).
 */
(function () {
  'use strict';

  var ORIGEN = 'https://www.internetderespaldo.com';
  var IMAGEN = ORIGEN + '/og-image.jpg';

  var BASE = {
    titulo: 'BackupNet - Internet de Respaldo Empresarial',
    descripcion: 'Conectividad de respaldo hibrida (micro enlace, satelite LEO y 4G/5G) para empresas en Mexico. Failover automatico en menos de 30 segundos.'
  };

  // Rutas canonicas del bundle (src/App.tsx). La clave es la ruta normalizada.
  var RUTAS = {
    '/': BASE,
    '/servicio': {
      titulo: 'Como funciona el internet de respaldo | BackupNet',
      descripcion: 'Micro enlace, satelite LEO y 4G/5G con failover automatico y monitoreo 24/7. Asi mantiene BackupNet tu empresa en linea cuando la fibra principal falla.'
    },
    '/precios': {
      titulo: 'Planes y precios de internet de respaldo | BackupNet',
      descripcion: 'Planes de conectividad de respaldo para empresas, con instalacion en 24 a 72 horas y soporte incluido. Cotiza el esquema que necesita tu operacion.'
    },
    '/contacto': {
      titulo: 'Contacto | BackupNet Internet de Respaldo',
      descripcion: 'Solicita una cotizacion de internet de respaldo empresarial. Escribenos a info@internetderespaldo.com o llama al +52 81 1996 1998.'
    },
    '/aviso-privacidad': {
      titulo: 'Aviso de privacidad | BackupNet',
      descripcion: 'Aviso de privacidad de BackupNet S.A. de C.V. sobre el tratamiento de datos personales conforme a la legislacion mexicana.'
    },
    '/terminos': {
      titulo: 'Terminos y condiciones | BackupNet',
      descripcion: 'Terminos y condiciones de uso del sitio y de los servicios de conectividad de respaldo de BackupNet.'
    },
    '/cookies': {
      titulo: 'Politica de cookies | BackupNet',
      descripcion: 'Como utiliza BackupNet las cookies y tecnologias similares en su sitio web.'
    },
    '/derechos-arco': {
      titulo: 'Derechos ARCO | BackupNet',
      descripcion: 'Ejerce tus derechos de Acceso, Rectificacion, Cancelacion y Oposicion sobre los datos personales que trata BackupNet.'
    }
  };

  // Quita el slash final, decodifica acentos y unifica variantes conocidas.
  function normalizar(ruta) {
    var limpia = ruta || '/';
    try {
      limpia = decodeURIComponent(limpia);
    } catch (e) {
      // URL mal codificada: se usa tal cual, es preferible a romper el canonical.
    }
    limpia = limpia.split('?')[0].split('#')[0];
    if (limpia.length > 1) {
      limpia = limpia.replace(/\/+$/, '');
    }
    if (!limpia) {
      limpia = '/';
    }
    limpia = limpia.toLowerCase();
    limpia = limpia
      .replace(/á/g, 'a')
      .replace(/é/g, 'e')
      .replace(/í/g, 'i')
      .replace(/ó/g, 'o')
      .replace(/ú/g, 'u');
    return limpia;
  }

  // Busca o crea una etiqueta en <head> segun un selector y sus atributos base.
  function etiqueta(selector, crear) {
    var cabeza = document.head;
    if (!cabeza) {
      return null;
    }
    var nodo = cabeza.querySelector(selector);
    if (!nodo) {
      nodo = crear();
      cabeza.appendChild(nodo);
    }
    return nodo;
  }

  function fijarMeta(atributo, nombre, contenido) {
    var selector = 'meta[' + atributo + '="' + nombre + '"]';
    var nodo = etiqueta(selector, function () {
      var m = document.createElement('meta');
      m.setAttribute(atributo, nombre);
      return m;
    });
    if (nodo) {
      nodo.setAttribute('content', contenido);
    }
  }

  function aplicar() {
    var ruta = normalizar(window.location.pathname);
    var conocida = Object.prototype.hasOwnProperty.call(RUTAS, ruta);
    // Una ruta desconocida la sirve la SPA como index.html: se apunta al home
    // para no generar canonicals de paginas que no existen.
    var destino = conocida ? ruta : '/';
    var datos = conocida ? RUTAS[ruta] : BASE;
    var canonica = ORIGEN + (destino === '/' ? '/' : destino);

    document.title = datos.titulo;

    var link = etiqueta('link[rel="canonical"]', function () {
      var l = document.createElement('link');
      l.setAttribute('rel', 'canonical');
      return l;
    });
    if (link) {
      link.setAttribute('href', canonica);
    }

    fijarMeta('name', 'description', datos.descripcion);
    fijarMeta('property', 'og:type', 'website');
    fijarMeta('property', 'og:site_name', 'BackupNet');
    fijarMeta('property', 'og:locale', 'es_MX');
    fijarMeta('property', 'og:url', canonica);
    fijarMeta('property', 'og:title', datos.titulo);
    fijarMeta('property', 'og:description', datos.descripcion);
    fijarMeta('property', 'og:image', IMAGEN);
    fijarMeta('name', 'twitter:card', 'summary_large_image');
    fijarMeta('name', 'twitter:title', datos.titulo);
    fijarMeta('name', 'twitter:description', datos.descripcion);
    fijarMeta('name', 'twitter:image', IMAGEN);
  }

  // Envuelve pushState / replaceState para enterarse de la navegacion de React
  // Router sin interferir con su comportamiento.
  function envolver(metodo) {
    var original = history[metodo];
    if (typeof original !== 'function') {
      return;
    }
    history[metodo] = function () {
      var resultado = original.apply(this, arguments);
      // La ruta ya cambio; se aplica en el siguiente tick por seguridad.
      window.setTimeout(aplicar, 0);
      return resultado;
    };
  }

  if (window.history && typeof window.history.pushState === 'function') {
    envolver('pushState');
    envolver('replaceState');
  }
  window.addEventListener('popstate', aplicar);

  aplicar();
  // Segunda pasada tras el primer render de React, por si hidrata mas tarde.
  window.addEventListener('load', aplicar);
})();
