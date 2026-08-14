# CLAUDE.md — Internet de Respaldo (BackupNet)

Guía operativa para agentes de IA y desarrolladores que trabajen en este repositorio.
Léela completa antes de tocar un archivo.

---

## 1. Visión general

Landing page comercial de **BackupNet / Internet de Respaldo**: conectividad
empresarial de respaldo (micro enlace, LEO, 4G/5G). El sitio capta leads mediante
un formulario que se envía por correo con Resend.

Producción: proyecto de Vercel `internet-backup`
(`prj_EHSUzJ4wZ2Tsohwyxp7HzPVpaBJU`, team `team_lwLV0pGdy3HxdHoDJq9vlVqQ`).

### ⚠️ Restricción crítica: este repo NO contiene el código fuente del frontend

El sitio es un **build estático ya compilado** (originalmente React + Vite). En el
repositorio solo existen los artefactos:

- `index.html` → carga `assets/index-pkHLO8D0.js` y `assets/index-CpNa9kZI.css`
- `assets/index-*.js` / `assets/index-*.css` → **bundles minificados, generados. NO editar a mano.**

No hay `package.json`, ni `src/`, ni `node_modules`, ni pipeline de build en el repo.
Toda funcionalidad nueva del cliente se agrega como **script vanilla adicional**
cargado desde `index.html` (patrón establecido en `assets/contact-form.js`).

Si una tarea exige modificar el comportamiento del bundle de React:
1. **Detente y avisa al usuario.** No intentes parchear el minificado.
2. Propón la alternativa: script vanilla enganchado por DOM/eventos, o recuperar
   el repositorio fuente y recompilar.

---

## 2. Stack exacto

| Capa | Tecnología | Versión / Notas |
|---|---|---|
| Frontend | HTML5 + bundle React/Vite precompilado | Solo artefactos; sin toolchain |
| Scripts propios | JavaScript ES5 vanilla (IIFE, `'use strict'`) | Sin frameworks, sin build |
| Fuentes | Google Fonts: Space Grotesk, Inter, JetBrains Mono | Vía `<link>` en `index.html` |
| Backend | Vercel Serverless Function, runtime **Node.js** | `api/contacto.js`, **CommonJS** (`module.exports`) |
| Dev server | Node.js nativo (`node:http`) | `dev-server.mjs`, **ESM**, cero dependencias |
| Runtime Node | Node.js 20+ (requiere `--env-file`) | Node 24 LTS es el default en Vercel |
| Email | API HTTP de Resend (`fetch` directo) | Sin SDK; no instalar `resend` |
| Base de datos | **Ninguna** | El sitio no persiste nada |
| Hosting / config | Vercel + `vercel.json` | Rewrites de SPA |

**Dependencias externas instaladas: cero.** Es una decisión de diseño, no un
descuido. No agregues `package.json` ni instales paquetes sin autorización explícita
del usuario.

---

## 3. Comandos frecuentes

```bash
# Desarrollo local (sitio estático + API en el mismo puerto)
node --env-file=.env.local dev-server.mjs      # → http://localhost:5500

# Variables de entorno: copiar y rellenar
cp .env.example .env.local

# Probar el endpoint de contacto
curl -X POST http://localhost:5500/api/contacto \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"Ana","empresa":"ACME","email":"ana@acme.com","telefono":"5512345678"}'

# Sintaxis de los archivos JS (no hay linter configurado)
node --check api/contacto.js
node --check assets/contact-form.js
node --check dev-server.mjs

# Vercel (requiere: npm i -g vercel)
vercel env pull .env.local     # traer variables del proyecto
vercel                          # deploy de preview
vercel --prod                   # deploy a producción
vercel logs <deployment-url>    # logs de la función
```

| Necesidad | Comando |
|---|---|
| Instalar deps | *No aplica — no hay dependencias* |
| Dev | `node --env-file=.env.local dev-server.mjs` |
| Build | *No aplica — los artefactos ya están versionados* |
| Test | *No hay suite. Verificación = `node --check` + prueba manual con `curl`* |
| Lint | *No hay linter. Sigue las convenciones de la sección 5* |

> Si el usuario pide "corre los tests" o "haz el build": no inventes un comando.
> Di que no existen y ofrece la verificación manual de arriba.

---

## 4. Estructura del proyecto

```
.
├── index.html                # Único HTML. Punto de entrada; aquí se registran los <script>
├── vercel.json               # Rewrites: todo lo que no sea /api/* → /index.html (fallback SPA)
├── dev-server.mjs            # Servidor local. Monta api/contacto.js y sirve estáticos
├── .env.example              # Plantilla de variables (versionada, SIN secretos)
├── .env.local                # Secretos reales — NUNCA commitear ni imprimir
├── api/
│   └── contacto.js           # Serverless Function → POST /api/contacto
├── assets/
│   ├── index-*.js|css        # GENERADOS. Bundle de React. Read-only
│   └── contact-form.js       # Script propio: conecta el form del bundle con la API
├── .vercel/project.json      # Vínculo con el proyecto de Vercel (gitignored)
└── *.jpg | *.png             # Imágenes del sitio, servidas desde la raíz
```

**Dónde va cada cosa:**

- **Nueva lógica de cliente** → nuevo archivo en `assets/` (ES5 vanilla, IIFE) +
  `<script src="./assets/mi-script.js" defer>` en `index.html`. Nunca dentro de `index-*.js`.
- **Nuevo endpoint** → `api/<nombre>.js`, CommonJS, mismo contrato que `contacto.js`.
  Vercel lo expone automáticamente en `/api/<nombre>`.
  Debe añadirse también su ruteo en `dev-server.mjs` para que exista en local.
- **Nueva variable de entorno** → declararla en `.env.example` (con valor vacío o
  placeholder si es secreta) **y** en el dashboard de Vercel. Documentarla en el
  encabezado del archivo que la consume.
- **Nueva imagen** → raíz del proyecto, referenciada con ruta relativa.

---

## 5. Reglas de código y arquitectura

### Generales

- **Idioma:** comentarios, mensajes de error de usuario y commits en **español**.
  Los identificadores del código también van en español (`nombre`, `empresa`,
  `mensaje`) para ser consistentes con lo existente.
- **Comentarios sin acentos** en bloques de encabezado (convención ya presente en
  el repo, para evitar problemas de encoding). El texto visible al usuario final
  **sí** lleva acentos correctos.
- Todo archivo nuevo abre con un **comentario de bloque** que explica: qué hace,
  cómo se ejecuta y qué variables de entorno consume. Igual que `api/contacto.js`.
- Commits: `tipo: descripción en minúsculas` (`feat:`, `fix:`, `chore:`, `docs:`).
- No hagas commit ni push salvo petición explícita del usuario.

### `api/*.js` — Serverless Functions

- **CommonJS obligatorio**: `module.exports = async function handler(req, res)`.
  No mezclar con `import`/`export` — `dev-server.mjs` los carga vía `createRequire`.
- El handler **siempre** debe funcionar con el `res` mínimo que provee
  `dev-server.mjs` (`res.status().json()`). No uses APIs de Express.
- Orden obligatorio de cada handler:
  1. Validar `req.method`; si no coincide → `res.setHeader('Allow', ...)` + `405`.
  2. Leer y parsear el body con límite de tamaño (ver `readBody`, tope 100 KB).
  3. Honeypot / anti-spam si es un formulario público.
  4. Sanear cada campo con `clean(valor, maxLongitud)`.
  5. Validar obligatorios y formatos → `400` con `{ ok:false, error:'…' }`.
  6. Efecto (envío, fetch externo) dentro de `try/catch`.
  7. Responder siempre `{ ok: boolean }` como forma estable del JSON.
- **Códigos de estado:** `200` éxito · `400` input inválido · `405` método ·
  `502` falló un servicio externo · `500` error inesperado.
- **Nunca** filtrar el detalle del error al cliente. El detalle va a
  `console.error` con prefijo `[<endpoint>]`; el cliente recibe un mensaje genérico.
- **Nunca** interpolar input del usuario en HTML sin pasar por `esc()`.
- Secretos: solo desde `process.env`. Jamás hardcodeados, jamás en logs.
- Degradación controlada: si falta la key de un servicio, loguear y responder de
  forma segura (ver el modo `{ ok:true, dev:true }` de `contacto.js`), no reventar.

### `assets/*.js` propios — cliente

- **ES5 dentro de una IIFE con `'use strict'`**: `var`, `function`, sin arrow
  functions, sin `const/let`, sin `async/await`. El bundle convive con navegadores
  antiguos y estos scripts no pasan por transpilador.
- Se enganchan al DOM del bundle de React **en fase de captura** y **sin**
  `preventDefault()`, para no romper el estado interno de React.
- Toda `fetch` lleva `.then` de parseo defensivo **y** `.catch`. Un fallo de red
  jamás debe producir un falso éxito visible.
- Feedback de error: insertar un nodo con `role="alert"` y ofrecer siempre una vía
  alterna de contacto.

### `index.html`

- Cambios mínimos y quirúrgicos. No reordenar ni tocar los `<script>`/`<link>` del
  bundle: sus nombres llevan hash y romperlos deja el sitio en blanco.
- Scripts propios siempre con `defer`.

### `vercel.json`

- El rewrite `/((?!api/).*)` → `/index.html` es lo que permite rutas tipo
  `/contacto`. Al agregar rutas o endpoints, verifica que el patrón siga excluyendo
  todo lo que deba servirse tal cual.

---

## 6. Directiva Anti-Errores (obligatoria)

Estas reglas no son sugerencias. Código que las incumpla se considera no entregado.

1. **Prohibido el código incompleto.** Nada de `// TODO`, `// FIXME`,
   `// implementar después`, `...`, cuerpos de función vacíos, `throw new Error('not
   implemented')` ni ejemplos parciales. Cada función que escribas queda funcional
   de extremo a extremo en la misma entrega.

2. **Prohibido el placeholder silencioso.** Nada de datos mock, URLs de ejemplo,
   claves falsas ni respuestas simuladas presentadas como implementación real. Si
   te falta un dato o una credencial, **pregunta**; no lo inventes.

3. **Validación de nulos y ausencias.** Antes de leer una propiedad, asume que el
   objeto puede ser `null`/`undefined`.
   - Body de request: puede llegar vacío, no ser JSON, o no ser un objeto.
   - `form.elements[name]`: puede no existir → verificar antes de leer `.value`.
   - `process.env.X`: puede estar ausente → default explícito o degradación segura.
   - Respuesta de API externa: verificar `r.ok` **antes** de confiar en el cuerpo.
   - Usa `?.` / `||` con default explícito, nunca accesos encadenados a ciegas.

4. **Casos límite, siempre cubiertos.** Para cada entrada considera y maneja:
   cadena vacía, solo espacios, longitud excesiva (usa `clean(v, max)`), caracteres
   HTML/`<script>` (usa `esc()`), email malformado, doble envío del formulario,
   red caída, timeout, y respuesta `5xx` del proveedor externo.

5. **Manejo de errores explícito.** Todo `await` de I/O va dentro de `try/catch`.
   Todo `.then` lleva su `.catch`. Prohibido el `catch {}` vacío salvo que el
   comentario adyacente justifique por qué ignorar es lo correcto (ver el fallback
   de SPA en `dev-server.mjs`).

6. **Seguridad no negociable.** Escapar toda salida HTML. Limitar tamaño de
   payload. No loguear secretos, tokens ni el contenido de `.env.local`. No
   introducir dependencias nuevas sin autorización.

7. **Verifica antes de declarar terminado.** Ejecuta `node --check` sobre cada
   archivo JS tocado y prueba el flujo real (`dev-server.mjs` + `curl` o navegador).
   Si algo quedó sin verificar o sin hacer, dilo explícitamente en tu respuesta —
   nunca reportes como completo lo que no probaste.
