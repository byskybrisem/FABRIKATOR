import {
  day,
  duration,
  market,
  profit,
  r,
  upgradePrice,
  DAY,
  type Command,
  type Game,
} from "../src/workshop.ts";
import {
  CorruptSave,
  openSave,
  resetSave,
  transact,
  type Save,
} from "./storage.ts";

const routes = {
  panel: "Ana panel",
  fabrikam: "Fabrikam",
  uretim: "Üretim",
  depo: "Depo",
  piyasa: "Piyasa",
  finans: "Finans",
} as const;
type Page = keyof typeof routes;
const marks: Record<Page, string> = {
  panel: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  fabrikam: "M3 21V10l6 3V8l6 4V4h4l2 17z M6 17h2m3 0h2m3 0h2",
  uretim: "M3 8h18v9H3z M7 12h2m3 0h2m3 0h1 M5 20h14 M7 4h10",
  depo: "M3 7l9-4 9 4v11l-9 4-9-4z M3 7l9 4 9-4m-9 4v11 M7 5l9 4",
  piyasa:
    "M3 10l2-6h14l2 6 M3 10q2 4 5 0 2 4 4 0 2 4 5 0 2 4 4 0 M5 13v7h14v-7",
  finans: "M3 3v17h18 M7 16v-4m5 4V8m5 8V5",
};
const icon = (page: Page) =>
  '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="' +
  marks[page] +
  '"/></svg>';
const nav = document.querySelector<HTMLElement>("#nav")!;
const screen = document.querySelector<HTMLElement>("#screen")!;
const message = document.querySelector<HTMLElement>("#message")!;
const dayLabel = document.querySelector<HTMLElement>("#day")!;
const fmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const money = (k: number) => fmt.format(k / 100) + " TL";
const secs = (ms: number) => Math.max(0, Math.ceil(ms / 1000));
const link = (to: Page, label: string) =>
  '<a class="cta" href="#' +
  to +
  '">' +
  label +
  ' <span aria-hidden="true">→</span></a>';
const button = (cmd: Command, label: string, disabled = false, qty = 1) =>
  '<button data-cmd="' +
  cmd +
  '" data-qty="' +
  qty +
  '" ' +
  (disabled ? "disabled" : "") +
  ">" +
  label +
  "</button>";
const line = (label: string, value: string | number) =>
  '<div class="line"><dt>' + label + "</dt><dd>" + value + "</dd></div>";
const card = (title: string, body: string) =>
  '<section class="card"><h2>' + title + "</h2>" + body + "</section>";
const metric = (label: string, value: string, kind: Page) =>
  '<div class="metric">' +
  icon(kind) +
  "<span>" +
  label +
  "</span><strong>" +
  value +
  "</strong></div>";
const names = {
  opening: "Açılış",
  buy: "Ham madde alımı",
  start: "Enerji ve paketleme",
  sell: "Net satış tahsilatı",
  finish: "Mamuller depoya girdi",
  assign: "Usta görevi",
  upgrade: "Makine yatırımı",
};
let db: IDBDatabase;
let state: Save;
let busy = false;
let shownDay = 0;
let lastTap = { command: "", at: -Infinity };
let channel: BroadcastChannel | undefined;
function page(): Page {
  const hash = location.hash.slice(1);
  return Object.hasOwn(routes, hash) ? (hash as Page) : "panel";
}
function panel(g: Game) {
  const next = g.job
    ? link("uretim", "Üretimi izle")
    : g.chairs
      ? link("piyasa", "Toptancı teklifini gör")
      : !g.lots
        ? link("depo", "Ham madde al")
        : !g.workers
          ? link("fabrikam", "Ustayı görevlendir")
          : link("uretim", "Üretime başla");
  return (
    '<section class="hero"><div class="scene"><img src="./workshop.png" alt="Ahşap paletler, yükleme alanı ve montaj binasıyla izometrik mobilya atölyesi"></div><div class="hero-copy"><span class="status"><i></i>' +
    (g.job ? "Hat çalışıyor" : "Hat hazır") +
    "</span><h2>Mobilya atölyesi</h2><p>Montaj hattı · Seviye " +
    g.level +
    "</p>" +
    next +
    "</div></section>" +
    '<div class="metrics">' +
    metric("Kasa", money(g.cash), "finans") +
    metric("Mamul stoku", g.chairs + " adet", "depo") +
    metric("Montaj ustası", g.workers ? "Hatta" : "Boşta", "fabrikam") +
    "</div>" +
    '<h2 class="subhead">Atölye yönetimi</h2><div class="tiles">' +
    (Object.keys(routes) as Page[])
      .filter((k) => k !== "panel")
      .map(
        (k) =>
          '<a href="#' +
          k +
          '">' +
          icon(k) +
          routes[k] +
          '<span aria-hidden="true">›</span></a>',
      )
      .join("") +
    "</div>"
  );
}
function contents(view: Page, g: Game, now: number) {
  const q = market(g, now);
  switch (view) {
    case "panel":
      return panel(g);
    case "depo":
      return (
        card(
          "Ham madde deposu",
          "<dl>" +
            line("Tahta", g.lots * r.boards) +
            line("Bağlantı seti", g.lots * r.kits) +
            line("Stok maliyeti", money(g.rawCost)) +
            "</dl><p>Bir parti için " +
            r.boards +
            " tahta ve " +
            r.kits +
            " bağlantı seti alınır.</p>" +
            button(
              "buy",
              "Bir parti al · " + money(r.materials),
              g.cash < r.materials,
            ),
        ) +
        card(
          "Mamul deposu",
          "<dl>" +
            line("Ahşap sandalye", g.chairs + " adet") +
            line("Depodaki mamul maliyeti", money(g.goodsCost)) +
            "</dl>",
        )
      );
    case "fabrikam":
      return (
        card(
          "Montaj ustası",
          "<dl>" +
            line("Görev", g.workers ? "Montaj hattı" : "Atama bekliyor") +
            "</dl>" +
            button(
              "assign",
              g.workers ? "Ustayı hattan al" : "Ustayı hatta ata",
              !!g.job,
            ),
        ) +
        card(
          "Montaj makinesi",
          "<dl>" +
            line("Seviye", g.level + " / 3") +
            line("Çevrim kapasitesi", r.batch * g.level + " sandalye") +
            line("Çevrim süresi", secs(duration(g)) + " sn") +
            line(
              "Yatırıma ayrılabilir kazanç",
              money(profit(g) - g.investment),
            ) +
            "</dl>" +
            (g.level < 3
              ? button(
                  "upgrade",
                  "Makineyi geliştir · " + money(upgradePrice(g)),
                  !!g.job ||
                    g.cash < upgradePrice(g) ||
                    profit(g) - g.investment < upgradePrice(g),
                )
              : "<p>En yüksek makine seviyesindesin.</p>"),
        )
      );
    case "uretim":
      return (
        card(
          "Ahşap sandalye",
          "<dl>" +
            line("Parti büyüklüğü", r.batch + " adet") +
            line("Ham madde", money(r.materials)) +
            line(
              "Enerji / paketleme",
              money(r.energy) + " / " + money(r.packaging),
            ) +
            line("Çevrim süresi", secs(duration(g)) + " sn") +
            "</dl>",
        ) +
        card(
          g.job ? "Hat çalışıyor" : "Üretim emri",
          g.job
            ? "<dl>" +
                line("Üretimde", g.job + " sandalye") +
                line("Depoya giriş", '<span id="remaining"></span>') +
                '</dl><progress id="progress" max="' +
                duration(g) +
                '"></progress>'
            : "<p>" +
                (g.lots
                  ? g.workers
                    ? "Çevrimde üretilecek miktarı seç."
                    : "Fabrikam ekranından ustayı hatta ata."
                  : "Depodan bir parti ham madde al.") +
                "</p>" +
                Array.from({ length: g.level }, (_, i) =>
                  button(
                    "start",
                    r.batch * (i + 1) +
                      " sandalye üret · " +
                      money((r.energy + r.packaging) * (i + 1)),
                    !g.workers ||
                      g.lots < i + 1 ||
                      g.cash < (r.energy + r.packaging) * (i + 1),
                    i + 1,
                  ),
                ).join(""),
        )
      );
    case "piyasa": {
      const n = Math.min(g.chairs, q.demand),
        gross = n * q.price;
      return card(
        "Toptancı teklifi",
        "<dl>" +
          line("Sandalye / adet", money(q.price)) +
          line("Günlük kalan talep", q.demand) +
          line("Depodaki sandalye", g.chairs) +
          line("Yeni teklife kalan", '<span id="quote-time"></span>') +
          line("Nakliye / adet", money(r.shippingPerUnit)) +
          line("Oyun vergisi", "%5") +
          line(
            "Kasaya girecek net tutar",
            money(gross - Math.round(gross * 0.05) - n * r.shippingPerUnit),
          ) +
          "</dl>" +
          button(
            "sell",
            n
              ? n + " sandalyeyi sat"
              : g.chairs
                ? "Yeni günün teklifini bekle"
                : "Satılacak sandalye yok",
            !n,
            n,
          ),
      );
    }
    case "finans":
      return (
        card(
          "Kâr ve zarar",
          "<dl>" +
            line("Satış geliri", money(g.income)) +
            line("Satılan ürün maliyeti", money(g.cogs)) +
            line("Nakliye", money(g.freight)) +
            line("Oyun vergisi", money(g.tax)) +
            line("Sabit gider öncesi kazanç", money(profit(g))) +
            "</dl>",
        ) +
        card(
          "Kasa ve yatırım",
          "<dl>" +
            line("Kasa", money(g.cash)) +
            line("Makine yatırımları", money(g.investment)) +
            "</dl>",
        ) +
        card(
          "Kayıt",
          "<p>İlerleme yalnızca bu tarayıcıda saklanır; bulut yedeği yoktur. Safari site verilerini silerse kayıt da silinir.</p>" +
            '<button class="secondary" data-act="reset">Yeni oyun başlat</button>',
        ) +
        card(
          "Son hareketler",
          "<dl>" +
            state.log
              .map((e) => line(names[e.kind], money(e.movement)))
              .join("") +
            "</dl>",
        )
      );
  }
}
function render() {
  const now = Date.now(),
    g = state.game,
    view = page();
  shownDay = day(g, now);
  dayLabel.textContent = "Gün " + String(shownDay).padStart(2, "0");
  nav.innerHTML = (Object.keys(routes) as Page[])
    .map(
      (k) =>
        '<a href="#' +
        k +
        '" ' +
        (view === k ? 'aria-current="page"' : "") +
        ">" +
        icon(k) +
        routes[k] +
        "</a>",
    )
    .join("");
  screen.innerHTML = "<h1>" + routes[view] + "</h1>" + contents(view, g, now);
  screen.setAttribute("aria-busy", "false");
  timers(now);
}
function timers(now: number) {
  const g = state.game,
    remaining = document.getElementById("remaining"),
    progress = document.querySelector<HTMLProgressElement>("#progress"),
    quote = document.getElementById("quote-time");
  // A clock moved backwards must not show more than one cycle; the engine still
  // waits for the real finish time, exactly like the mobile save.
  const left = Math.min(duration(g), Math.max(0, g.ready - now));
  if (remaining) remaining.textContent = secs(left) + " sn";
  if (progress) progress.value = duration(g) - left;
  if (quote)
    quote.textContent =
      secs(g.born + shownDay * DAY - Math.max(now, g.last)) + " sn";
}
let broken = false;
function recovery(reason: string) {
  broken = true;
  nav.innerHTML = "";
  dayLabel.textContent = "Kayıt sorunu";
  screen.innerHTML =
    "<h1>Kayıt açılamadı</h1>" +
    card(
      "Atölye kaydı doğrulanamadı",
      "<p>" +
        reason +
        "</p><p>Kayıt silinmedi. Yeni oyun başlatırsan mevcut kayıt bu tarayıcıda yedek olarak saklanır.</p>" +
        '<button data-act="reset">Kaydı yedekle, yeni oyun başlat</button>',
    );
  screen.setAttribute("aria-busy", "false");
}
async function refresh() {
  if (!db || busy) return;
  busy = true;
  try {
    state = await transact(db);
    broken = false;
    render();
  } catch (error) {
    if (error instanceof CorruptSave) recovery(error.message);
    else
      message.textContent =
        error instanceof Error
          ? error.message
          : "Yerel kayıt okunamadı. Sayfayı yeniden açmayı dene.";
  } finally {
    busy = false;
  }
}
async function reset() {
  const warning = broken
    ? "Okunamayan kayıt yedeklenecek ve 150.000 TL ile yeni bir atölye açılacak. Devam edilsin mi?"
    : "Mevcut ilerlemen silinecek ve 150.000 TL ile yeni bir atölye açılacak. Bu işlem geri alınamaz. Devam edilsin mi?";
  if (!window.confirm(warning)) return;
  busy = true;
  try {
    state = await resetSave(db);
    broken = false;
    location.hash = "panel";
    message.textContent = "Yeni oyun başladı.";
    channel?.postMessage(state.game.rev);
  } catch {
    message.textContent = "Yeni oyun başlatılamadı. Sayfayı yenileyip tekrar dene.";
  } finally {
    busy = false;
    if (!broken) render();
  }
}
screen.addEventListener("click", async (event) => {
  const act = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "button[data-act='reset']",
  );
  if (act && !busy && db) return void reset();
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "button[data-cmd]",
  );
  if (!target || target.disabled || busy || !state) return;
  const cmd = target.dataset.cmd as Exclude<Command, "finish">;
  const tapTime = performance.now();
  if (cmd === lastTap.command && tapTime - lastTap.at < 450) return;
  lastTap = { command: cmd, at: tapTime };
  busy = true;
  target.disabled = true;
  try {
    state = await transact(db, {
      command: cmd,
      revision: state.game.rev,
      born: state.game.born,
      quantity: Number(target.dataset.qty),
      quoteDay: shownDay,
    });
    message.textContent = names[cmd] + " kaydedildi.";
    channel?.postMessage(state.game.rev);
  } catch (error) {
    message.textContent =
      error instanceof Error ? error.message : "İşlem kaydedilemedi.";
    try {
      state = await transact(db);
    } catch (reload) {
      if (reload instanceof CorruptSave) broken = true;
      message.textContent = "Yerel kayıt okunamadı.";
    }
  } finally {
    busy = false;
    if (broken) recovery("Kayıt doğrulanamadı.");
    else render();
  }
});
window.addEventListener("hashchange", () => {
  if (state && !broken) {
    message.textContent = "";
    render();
    window.scrollTo(0, 0);
  }
});
window.addEventListener("pageshow", () => void refresh());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void refresh();
});
// A direct link such as /FABRIKATOR/depo (served by 404.html or the offline worker)
// becomes the equivalent in-app route so reloading never needs a server.
function routeFromPath() {
  const parts = location.pathname.split("/");
  const last = parts.pop()?.toLowerCase() ?? "";
  if (Object.hasOwn(routes, last))
    history.replaceState(null, "", parts.join("/") + "/#" + last);
}
async function start() {
  try {
    routeFromPath();
    db = await openSave();
    await refresh();
    if (state && state.log.length > 1)
      message.textContent = "Kayıtlı atölyen yüklendi. Kaldığın yerden devam et.";
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel("fabrikator-workshop");
      channel.onmessage = () => void refresh();
    }
    window.setInterval(() => {
      if (!state || busy || broken || document.hidden) return;
      const now = Date.now(),
        g = state.game;
      if (g.ready && now >= g.ready) void refresh();
      else if (day(g, now) !== shownDay) render();
      else timers(now);
    }, 500);
  } catch {
    message.textContent =
      "Atölye açılamadı. Safari’de site verilerine izin verip tekrar dene.";
    screen.textContent = "";
  }
}
void start();
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {
    /* Online play still saves to IndexedDB. */
  });
