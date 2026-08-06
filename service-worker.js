/* ==========================================================================
   service-worker.js
   Cacheia o "app shell" (HTML/CSS/JS/ícones) para que o sistema abra
   instantaneamente e funcione offline para consulta de dados já carregados.
   Os dados vivos (Google Sheets via Apps Script) NÃO são cacheados aqui —
   sempre buscados em rede pela Fetch API em api.js.
   ========================================================================== */

const CACHE_NOME = "escala-rosario-v1";

const ARQUIVOS_APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/variables.css",
  "./css/style.css",
  "./css/components.css",
  "./css/responsive.css",
  "./css/animations.css",
  "./js/config.js",
  "./js/storage.js",
  "./js/api.js",
  "./js/ui.js",
  "./js/auth.js",
  "./js/notifications.js",
  "./js/members.js",
  "./js/churches.js",
  "./js/events.js",
  "./js/scheduler.js",
  "./js/dashboard.js",
  "./js/admin.js",
  "./js/app.js",
  "./assets/logo/logo-pastoral.png",
  "./assets/logo/logo-paroquia.png",
  "./assets/logo/favicon.png",
  "./assets/logo/splash-icon.png"
];

/* ---- Instalação: cacheia o app shell ---- */
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NOME).then((cache) => {
      // addAll falha inteiro se um arquivo faltar (ex.: logo ainda não enviada).
      // Por isso adicionamos individualmente e ignoramos falhas isoladas.
      return Promise.all(
        ARQUIVOS_APP_SHELL.map((arquivo) =>
          cache.add(arquivo).catch((erro) => {
            console.warn("[service-worker] não foi possível cachear:", arquivo, erro);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

/* ---- Ativação: remove caches antigos de versões anteriores ---- */
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(
        chaves
          .filter((chave) => chave !== CACHE_NOME)
          .map((chave) => caches.delete(chave))
      )
    )
  );
  self.clients.claim();
});

/* ---- Estratégia de busca ----
   - Requisições para o Google Apps Script (API de dados): sempre rede,
     nunca cache — os dados precisam estar sempre atualizados.
   - Demais requisições (app shell): cache-first, com atualização em
     segundo plano (stale-while-revalidate). */
self.addEventListener("fetch", (evento) => {
  const url = evento.request.url;

  const ehChamadaDeApi = url.includes("script.google.com");

  if (ehChamadaDeApi) {
    evento.respondWith(fetch(evento.request));
    return;
  }

  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      const buscaRede = fetch(evento.request)
        .then((respostaRede) => {
          caches.open(CACHE_NOME).then((cache) => {
            cache.put(evento.request, respostaRede.clone());
          });
          return respostaRede;
        })
        .catch(() => respostaCache); // offline: usa o que já tem em cache

      return respostaCache || buscaRede;
    })
  );
});
