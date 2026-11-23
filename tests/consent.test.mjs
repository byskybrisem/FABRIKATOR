import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

// Mobil ekranlarda bileşen testi altyapısı yok; kredi onayı kuralı kaynak düzeyinde korunur:
// kredi açan her işlem (borrow veya finansmanlı upgrade) yalnız askLoan onay penceresinden geçer.
test("mobil ekranlar krediyi onay penceresi (askLoan) olmadan açamaz", () => {
  const offenders = [];
  for (const file of readdirSync("app").filter((f) => f.endsWith(".tsx"))) {
    const src = readFileSync("app/" + file, "utf8");
    for (const m of src.matchAll(
      /execute\(\s*"(borrow|upgrade)"\s*,\s*\{[^}]*loan\s*:/g,
    ))
      offenders.push(file + ": " + m[0].replace(/\s+/g, " "));
  }
  assert.deepEqual(offenders, []);
  for (const file of ["banka.tsx", "fabrikam.tsx"])
    assert.match(
      readFileSync("app/" + file, "utf8"),
      /askLoan\(/,
      file + " askLoan kullanmalı",
    );
});
