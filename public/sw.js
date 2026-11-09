const CACHE = "auto-dyali-shell-v7";
const SHELL = ["./", "./icons/auto-dyali-192.png", "./icons/auto-dyali-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

/**
 * Stratégie :
 * - Requêtes non-GET ou API Supabase (REST/JSON) → réseau uniquement.
 *   Jamais de mise en cache des données : hors ligne, on ne sert JAMAIS
 *   des données potentiellement périmées comme si elles étaient réelles.
 * - Navigations (HTML) → réseau d'abord, repli sur la page mise en cache
 *   (la dernière version vue reste consultable hors connexion).
 * - Assets statiques (/_next/static, images, polices) → cache d'abord,
 *   ils sont immuables puisque leur URL contient un hash.
 */
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isApi = /\/rest\/v1\/|\/auth\/v1\/|\/functions\/v1\//.test(url.pathname);
  if (isApi) return; // réseau uniquement, aucune donnée API en cache

  const isStaticAsset = sameOrigin && (
    // Uniquement les URLs RÉELLEMENT immuables (hash de contenu Next.js)
    // ou les médias. Les .js/.css HORS /_next/static/ ne sont PAS ici :
    // ils suivent la stratégie réseau-d'abord (repli cache) afin qu'une
    // mise à jour du POS soit toujours visible sans manipulation.
    url.pathname.includes("/_next/static/") ||
    /\.(?:png|jpe?g|webp|svg|ico|woff2?)$/i.test(url.pathname)
  );

  if (isStaticAsset) {
    // Cache d'abord (URLs hashées = immuables), puis réseau.
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
      )
    );
    return;
  }

  if (request.mode === "navigate") {
    // Réseau d'abord pour avoir la version fraîche, repli cache hors ligne.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("./") || Response.error())
        )
    );
    return;
  }

  // Autres GET (mêmes origines) : réseau d'abord, repli cache.
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});
