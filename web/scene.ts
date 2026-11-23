import { seats, type Game } from "../src/workshop.ts";

// Hafif izometrik atölye sahnesi. Oyun durumundan her çizimde yeniden üretilir;
// harici görsel veya kütüphane kullanmaz.
type P = [number, number];
const iso = (x: number, y: number, z = 0): P => [
  212 + (x - y) * 0.866,
  44 + (x + y) * 0.5 - z,
];
const pts = (...p: P[]) =>
  p.map(([a, b]) => a.toFixed(1) + "," + b.toFixed(1)).join(" ");
const poly = (fill: string, ...p: P[]) =>
  `<polygon fill="${fill}" points="${pts(...p)}"/>`;

/** Görünen üç yüzü olan kutu. Renkler: üst, sağ (x+), sol (y+). */
function box(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  [top, right, left]: [string, string, string],
  extra = "",
) {
  return (
    `<g ${extra}>` +
    poly(
      left,
      iso(x, y + d, z),
      iso(x + w, y + d, z),
      iso(x + w, y + d, z + h),
      iso(x, y + d, z + h),
    ) +
    poly(
      right,
      iso(x + w, y, z),
      iso(x + w, y + d, z),
      iso(x + w, y + d, z + h),
      iso(x + w, y, z + h),
    ) +
    poly(
      top,
      iso(x, y, z + h),
      iso(x + w, y, z + h),
      iso(x + w, y + d, z + h),
      iso(x, y + d, z + h),
    ) +
    "</g>"
  );
}

const steel: [string, string, string] = ["#c8d0ce", "#7f8b89", "#9aa6a4"];
const dark: [string, string, string] = ["#56615f", "#323b3a", "#414b4a"];
const wood: [string, string, string] = ["#c99a62", "#8a6340", "#a57b4d"];
const pallet: [string, string, string] = ["#8f6c49", "#5a4330", "#6f543a"];
const carton: [string, string, string] = ["#d3ab72", "#94703f", "#b38a54"];

function person(x: number, y: number, vest: string, cls: string) {
  const [sx, sy] = iso(x, y);
  return (
    // Konum dış grupta; CSS animasyonu iç grupta, böylece transform özelliği konumu ezmez.
    `<g transform="translate(${sx.toFixed(1)} ${sy.toFixed(1)})"><g class="${cls}">` +
    `<ellipse cx="0" cy="0" rx="6" ry="2.6" fill="#0b1011" opacity=".45"/>` +
    `<rect x="-3.2" y="-9" width="2.6" height="9" rx="1" fill="#2c3a4a"/>` +
    `<rect x=".6" y="-9" width="2.6" height="9" rx="1" fill="#24313f"/>` +
    `<path d="M-4.6 -9 Q-5 -18 0 -18.6 Q5 -18 4.6 -9 Z" fill="${vest}"/>` +
    `<rect x="-4.4" y="-13.4" width="8.8" height="1.3" fill="#e9eef0" opacity=".85"/>` +
    `<circle cx="0" cy="-21.6" r="3.1" fill="#e2b58f"/>` +
    `<path d="M-3.6 -22.4 Q0 -27.4 3.6 -22.4 Z" fill="#f2c230"/>` +
    "</g></g>"
  );
}

export function scene(g: Game, running: boolean) {
  const out: string[] = [];
  const lit = running ? "#f6cf7a" : "#33464a";
  // Zemin: beton döşeme ve emniyet şeridi.
  out.push(
    poly("#283030", iso(0, 0), iso(230, 0), iso(230, 170), iso(0, 170)),
    poly("#2f3837", iso(0, 0), iso(230, 0), iso(230, 4), iso(0, 4)),
  );
  for (let i = 1; i < 6; i++) {
    const a = iso(i * 38, 0),
      b = iso(i * 38, 170);
    out.push(
      `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#313b3a" stroke-width=".7"/>`,
    );
  }
  // Arka duvarlar, oluklu sac ve pencereler.
  out.push(
    poly(
      "#1d2829",
      iso(0, 0, 0),
      iso(0, 170, 0),
      iso(0, 170, 74),
      iso(0, 0, 74),
    ),
    poly(
      "#223031",
      iso(0, 0, 0),
      iso(230, 0, 0),
      iso(230, 0, 74),
      iso(0, 0, 74),
    ),
  );
  for (let x = 8; x < 230; x += 9) {
    const a = iso(x, 0, 2),
      b = iso(x, 0, 72);
    out.push(
      `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#2a393a" stroke-width="1.6"/>`,
    );
  }
  for (const x of [22, 70, 118, 166]) {
    out.push(
      poly(
        lit,
        iso(x, 0, 40),
        iso(x + 34, 0, 40),
        iso(x + 34, 0, 60),
        iso(x, 0, 60),
      ).replace("<polygon", `<polygon class="${running ? "glow" : ""}"`),
      poly(
        "#1a2324",
        iso(x + 16, 0, 40),
        iso(x + 18, 0, 40),
        iso(x + 18, 0, 60),
        iso(x + 16, 0, 60),
      ),
    );
  }
  // Sol duvarda takım rafı ve yangın tüpü.
  out.push(
    poly(
      "#2c3839",
      iso(0, 70, 22),
      iso(0, 118, 22),
      iso(0, 118, 50),
      iso(0, 70, 50),
    ),
    poly(
      "#3b4a4b",
      iso(0, 70, 34),
      iso(0, 118, 34),
      iso(2, 118, 34),
      iso(2, 70, 34),
    ),
    poly(
      "#6f7f7e",
      iso(0, 78, 37),
      iso(0, 84, 37),
      iso(0, 84, 47),
      iso(0, 78, 47),
    ),
    poly(
      "#8a6a3d",
      iso(0, 92, 24),
      iso(0, 104, 24),
      iso(0, 104, 31),
      iso(0, 92, 31),
    ),
    poly(
      "#c0392b",
      iso(0, 126, 8),
      iso(0, 130, 8),
      iso(0, 130, 24),
      iso(0, 126, 24),
    ),
  );
  out.push(
    `<text transform="matrix(.866 .5 0 1 ${iso(26, 0, 30)[0].toFixed(1)} ${iso(26, 0, 30)[1].toFixed(1)})" class="sign">FABRİKATÖR · MONTAJ ATÖLYESİ</text>`,
  );
  // Hat çalışırken tavan lambalarının zemindeki ışığı.
  if (running)
    for (const [x, y] of [
      [90, 60],
      [140, 60],
      [190, 120],
    ]) {
      const [cx, cy] = iso(x, y);
      out.push(
        `<ellipse class="glow" cx="${cx}" cy="${cy}" rx="46" ry="22" fill="url(#pool)"/>`,
      );
    }
  // Mola alanı: bank ve boştaki çalışanlar.
  out.push(box(14, 132, 0, 34, 10, 6, dark));
  const idle = Math.min(g.staff - g.workers, 4);
  for (let i = 0; i < idle; i++)
    out.push(person(18 + i * 9, 150, "#6b7f86", "idle"));
  // Ham madde paletleri (en fazla 4 yığın görünür).
  const stacks = Math.min(g.lots, 4);
  for (let i = 0; i < 4; i++) {
    const y = 12 + i * 28;
    out.push(box(10, y, 0, 30, 22, 4, pallet));
    if (i < stacks)
      for (let layer = 0; layer < 3; layer++)
        out.push(box(11, y + 1, 4 + layer * 4, 28, 20, 3.6, wood));
  }
  // Montaj hattı: bant, pres ve emniyet çizgileri.
  const line = 60,
    belt = [62, 44] as const;
  out.push(
    poly(
      "#d3a92f",
      iso(line - 4, 36),
      iso(line + 118, 36),
      iso(line + 118, 98),
      iso(line - 4, 98),
    ),
    poly(
      "#283030",
      iso(line - 2, 38),
      iso(line + 116, 38),
      iso(line + 116, 96),
      iso(line - 2, 96),
    ),
    box(line, belt[0] - 14, 0, 96, 22, 14, dark),
  );
  const b1 = iso(line + 2, belt[0] - 3, 14.2),
    b2 = iso(line + 94, belt[0] - 3, 14.2);
  out.push(
    `<line class="belt${running ? " run" : ""}" x1="${b1[0]}" y1="${b1[1]}" x2="${b2[0]}" y2="${b2[1]}"/>`,
  );
  // Bant üstünde işlenen sandalye kasaları.
  if (running)
    for (let i = 0; i < 3; i++)
      out.push(
        box(
          line + 10 + i * 28,
          belt[0] - 11,
          14,
          12,
          10,
          7,
          carton,
          `class="ride" style="--d:${i * 0.6}s"`,
        ),
      );
  // Pres / montaj istasyonu, seviyeye göre büyür.
  const px = line + 88;
  out.push(box(px, 32, 0, 30, 44, 30 + g.level * 6, steel));
  out.push(box(px + 4, 36, 30 + g.level * 6, 20, 20, 6, dark));
  const lamp = iso(px + 14, 46, 42 + g.level * 6);
  const lampColor = running
    ? "#7fd36a"
    : g.workers && g.lots
      ? "#e6b84a"
      : "#e0634a";
  out.push(
    `<circle cx="${lamp[0]}" cy="${lamp[1]}" r="3.4" fill="${lampColor}" class="${running ? "pulse" : ""}"/>`,
  );
  if (running)
    for (let i = 0; i < 3; i++) {
      const [sx, sy] = iso(px + 12, 40, 44 + g.level * 6);
      out.push(
        `<circle class="steam" style="--d:${i * 0.9}s" cx="${sx}" cy="${sy}" r="3" fill="#c9d4d4"/>`,
      );
    }
  // Hat koltukları: dolu koltukta çalışan, boşta sarı zemin işareti.
  const n = seats(g.level);
  for (let i = 0; i < n; i++) {
    const x = line + 12 + i * 24,
      y = belt[0] + 18;
    if (i < g.workers) out.push(person(x, y, "#ef7a2e", running ? "work" : ""));
    else
      out.push(
        poly(
          "none",
          iso(x - 6, y - 5),
          iso(x + 6, y - 5),
          iso(x + 6, y + 5),
          iso(x - 6, y + 5),
        ).replace(
          'fill="none"',
          'fill="none" stroke="#d3a92f" stroke-dasharray="3 2" stroke-width="1.2"',
        ),
      );
  }
  // Mamul alanı: koli yığınları (her koli ~5 sandalye).
  const cartons = Math.min(Math.ceil(g.chairs / 5), 12);
  for (let i = 0; i < cartons; i++) {
    const col = i % 3,
      row = Math.floor(i / 3) % 2,
      layer = Math.floor(i / 6);
    out.push(
      box(172 + col * 15, 112 + row * 16, layer * 11, 13, 13, 11, carton),
    );
  }
  // Yükleme rampası ve kamyon: satılacak mal varsa rampaya yanaşır.
  out.push(box(226, 104, 0, 10, 52, 6, dark));
  if (g.chairs > 0) {
    out.push(box(238, 104, 4, 62, 50, 34, ["#e9edec", "#a9b3b2", "#c9d1d0"]));
    out.push(box(300, 108, 4, 22, 42, 26, ["#2f8c87", "#1d5a57", "#257370"]));
    const w1 = iso(252, 154, 3),
      w2 = iso(306, 150, 3);
    out.push(
      `<circle cx="${w1[0]}" cy="${w1[1]}" r="5" fill="#111"/><circle cx="${w2[0]}" cy="${w2[1]}" r="5" fill="#111"/>`,
    );
  }
  return (
    `<svg class="factory" viewBox="40 14 420 272" role="img" aria-label="${describe(g, running)}">` +
    `<defs><radialGradient id="pool"><stop offset="0" stop-color="#ffe2a0" stop-opacity=".2"/><stop offset="1" stop-color="#ffe2a0" stop-opacity="0"/></radialGradient></defs>` +
    out.join("") +
    "</svg>"
  );
}

function describe(g: Game, running: boolean) {
  return (
    "Montaj atölyesi: " +
    (running ? "hat çalışıyor" : "hat duruyor") +
    ", hatta " +
    g.workers +
    " çalışan, boşta " +
    (g.staff - g.workers) +
    ", " +
    g.lots +
    " parti ham madde, " +
    g.chairs +
    " sandalye"
  );
}
