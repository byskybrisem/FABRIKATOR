import { copyFile, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const out = new URL("../dist/site/", import.meta.url);
const files = [
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "icon.png",
  "workshop.png",
];
for (const file of files)
  await copyFile(new URL(file, import.meta.url), new URL(file, out));
for (const dir of ["src", "web"]) {
  for (const file of (await readdir(new URL(dir + "/", out))).sort()) {
    if (file.endsWith(".js")) files.push(dir + "/" + file);
  }
}
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(new URL(file, out)));
const worker = await readFile(
  new URL("worker.template.js", import.meta.url),
  "utf8",
);
hash.update(worker);
const version = hash.digest("hex").slice(0, 16);
await writeFile(
  new URL("sw.js", out),
  worker
    .replace("__VERSION__", version)
    .replace("__FILES__", JSON.stringify(files)),
);
// Görünür sürüm etiketi: sayfa ve çalışan aynı kimliği taşır; yayında hangi sürümün
// yüklü olduğu buradan doğrulanır.
const stamp = version.slice(0, 8);
const page = await readFile(new URL("index.html", out), "utf8");
await writeFile(
  new URL("index.html", out),
  page.replaceAll("__BUILD__", stamp),
);
// GitHub Pages serves 404.html for unknown paths. Turn /FABRIKATOR/depo into
// /FABRIKATOR/#depo without hard-coding the repository name.
// web/game.ts içindeki `routes` ile aynı olmalı; test her ekranın doğrudan bağlantısını dener.
const pages = [
  "panel",
  "fabrikam",
  "depo",
  "uretim",
  "piyasa",
  "siparisler",
  "finans",
  "sirket",
];
await writeFile(
  new URL("404.html", out),
  `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FABRİKATÖR</title><script>
const pages=${JSON.stringify(pages)};
const parts=location.pathname.split("/").filter(Boolean);
const hit=parts.findIndex(p=>pages.includes(p.toLowerCase()));
const base="/"+parts.slice(0,hit>0?hit:1).join("/")+"/";
location.replace(base+(hit>0?"#"+parts[hit].toLowerCase():""));
</script></head><body style="background:#101719;color:#e8efe9;font-family:system-ui;padding:24px"><p>FABRİKATÖR açılıyor… <a style="color:#c4e86b" href="/">Ana sayfa</a></p></body></html>
`,
);
