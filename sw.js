/* Service worker сайта «Чудный сад».
   Каталог и страница — network-first (покупатель видит свежий
   ассортименты после публикации), остальное — cache-first. */
var CACHE = "chudni-sad-v20-1";

var CORE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./data/catalog.js",
  "./manifest.json",
  "./assets/img/logo.png",
  "./assets/img/favicon.png",
  "./assets/img/icon-192.png",
  "./assets/img/icon-512.png"
];

/* Свежесть важнее мгновения: сеть первой, кэш — если сети нет */
var FRESH = ["/data/catalog.js", "/index.html", "/"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(CORE.map(function (url) {
        return cache.add(url).catch(function () { /* битый URL не валил SW */ });
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;   /* Google Fonts и пр. — мимо SW */

  var wantsFresh = CORE.some(function (p) {
    return url.pathname.endsWith(p.replace("./", "/"));
  }) || url.pathname === "/chudni-sad/" || url.pathname === "/chudni-sad/index.html" ||
     url.pathname === "/chudni-sad/data/catalog.js";

  if (wantsFresh) {
    /* network-first: страница и каталог почти всегда из сети, кэш — как страховка */
    e.respondWith(
      fetch(req).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return resp;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || Response.error(); });
      })
    );
    return;
  }

  /* cache-first: фотографии, стили, скрипты, иконки */
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (resp) {
        if (resp && resp.ok && resp.type === "basic") {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return resp;
      });
    })
  );
});
