const root = self.registration.scope;
const prefix = "fabrikator:" + root + ":";
const name = prefix + "__VERSION__";
const urls = __FILES__.map((file) => new URL(file, root).href);
// Yeni sürüm indirilir indirilmez devralır: bekleyen çalışan, iPhone'da ana ekrana eklenmiş
// uygulama hiç tam kapanmadığı için eski sürümde takılı kalmasın. Açık sayfa zorla yenilenmez;
// sayfa "Güncelleme hazır" gösterir. Önbellek yalnız oyun dosyalarını tutar; IndexedDB'deki
// kayda dokunulmaz.
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(name)
      .then((cache) =>
        cache.addAll(urls.map((url) => new Request(url, { cache: "reload" }))),
      )
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(prefix) && k !== name)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(root)) return;
  const url =
    req.mode === "navigate" ? new URL("index.html", root).href : req.url;
  if (!urls.includes(url)) return;
  event.respondWith(
    caches
      .open(name)
      .then(async (cache) => (await cache.match(url)) || fetch(req)),
  );
});
