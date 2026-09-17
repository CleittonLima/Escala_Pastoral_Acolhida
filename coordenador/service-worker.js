/* ==========================================================================
   service-worker.js (app do Coordenador)
   Cacheia o app shell do app do Coordenador. Os dados vivos (Google Sheets
   via Apps Script) nunca são cacheados — sempre buscados em rede.
   ========================================================================== */

const CACHE_NOME = "escala-rosario-coordenador-v3";

const ARQUIVOS_APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "../shared/css/variables.css",
  "../shared/css/style.css",
  "../shared/css/components.css",
  "../shared/css/responsive.css",
  "../shared/css/animations.css",
  "../shared/css/print.css",
  "../shared/css/coordenador.css",
  "../shared/js/config.js",
  "../shared/js/storage.js",
  "../shared/js/api.js",
  "../shared/js/ui.js",
  "../shared/js/helpers.js",
  "./js/auth.js",
  "./js/notifications.js",
  "./js/admin.js",
  "./js/churches.js",
  "./js/events.js",
  "./js/scheduler.js",
  "./js/dashboard.js",
  "./js/app.js",
  "../shared/assets/logo/logo-pastoral.png",
  "../shared/assets/logo/logo-paroquia.png",
  "../shared/assets/logo/favicon.png",
  "../shared/assets/logo/splash-icon.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NOME).then((cache) =>
      Promise.all(
        ARQUIVOS_APP_SHELL.map((arquivo) =>
          cache.add(arquivo).catch((erro) => console.warn("[sw-coordenador] não cacheado:", arquivo, erro))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((c) => c !== CACHE_NOME).map((c) => caches.delete(c)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  if (evento.request.url.includes("script.google.com")) {
    evento.respondWith(fetch(evento.request));
    return;
  }

  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      const buscaRede = fetch(evento.request)
        .then((respostaRede) => {
          caches.open(CACHE_NOME).then((cache) => cache.put(evento.request, respostaRede.clone()));
          return respostaRede;
        })
        .catch(() => respostaCache);
      return respostaCache || buscaRede;
    })
  );
});
