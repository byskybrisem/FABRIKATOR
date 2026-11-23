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
await writeFile(
  new URL("sw.js", out),
  worker
    .replace("__VERSION__", hash.digest("hex").slice(0, 16))
    .replace("__FILES__", JSON.stringify(files)),
);
