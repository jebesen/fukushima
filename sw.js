/* Service worker del curso.
   - Al instalar guarda la interfaz y TODO el texto del curso (fragmentos HTML, tests e índice de búsqueda).
   - Imágenes y PDF se guardan al visitarlos (cache-first).
   - Sube VERSION cada vez que publiques cambios para forzar la actualización en los móviles. */
const VERSION = 'v9';
const SHELL = `fuku-shell-${VERSION}`;
const RUNTIME = `fuku-media-${VERSION}`;
const MAX_MEDIA = 400; // nº máximo de imágenes/PDF en caché

const CRITICAL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/config.js', 'manifest.webmanifest', 'data/course.json'];
const OPTIONAL = [
  'js/tsunami.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'assets/images/logo.png', 'assets/images/logo_uned.png', 'assets/images/CC.png',
  'assets/images/iconos/icon1.png', 'assets/images/iconos/icon2.png', 'assets/images/iconos/icon3.png',
];

// Descarga saltando la caché HTTP del navegador/servidor: así una versión nueva nunca guarda contenido antiguo.
async function addFresh(cache, url) {
  const res = await fetch(new Request(url, { cache: 'reload' }));
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await cache.put(url, res);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(CRITICAL.map((u) => addFresh(cache, u)));
    const urls = [...OPTIONAL, 'data/search.json'];
    try {
      const course = await (await cache.match('data/course.json')).json();
      for (const u of course.units) {
        for (const l of u.lessons) urls.push(`content/${u.id}/${l.id}.${l.type === 'quiz' ? 'json' : 'html'}`);
        for (const x of u.extras || []) urls.push(`content/${u.id}/${x.id}.html`);
      }
    } catch { /* se guardará al visitar */ }
    await Promise.allSettled(urls.map((u) => addFresh(cache, u)));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (![SHELL, RUNTIME].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return; // PDF/vídeo parciales: directo a red
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // YouTube, enlaces externos…
  const media = /\.(png|jpe?g|gif|webp|svg|ico|pdf|woff2?)$/i.test(url.pathname);
  event.respondWith(media ? cacheFirst(req) : staleWhileRevalidate(req, event));
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) {
    const cache = await caches.open(RUNTIME);
    await cache.put(req, res.clone());
    trim(cache);
  }
  return res;
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
  const update = fetch(req, { cache: 'no-cache' })
    .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
    .catch(() => null);
  if (hit) { event.waitUntil(update); return hit; }
  const res = await update;
  if (res) return res;
  if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
  return new Response('', { status: 504, statusText: 'Sin conexión' });
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_MEDIA; i++) await cache.delete(keys[i]);
}
