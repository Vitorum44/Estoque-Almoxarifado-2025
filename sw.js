self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("controle-material-v1").then((cache) => {
      return cache.addAll([
        "index.html",
        "estoque.html",
        "registro.html",
        "login.html",
        "styles.css",
        "estoque.js",
        "script.js"
      ]);
    })
  );
  console.log("📦 Service Worker instalado com sucesso");
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
