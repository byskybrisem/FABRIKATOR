import {
  available,
  catalog,
  counterPrice,
  customers,
  cycle,
  day,
  duration,
  lockReason,
  lotsOf,
  market,
  maxLots,
  offerGain,
  products,
  profit,
  salesProfit,
  seats,
  stockValue,
  upgradePrice,
  CAPITAL,
  DAY,
  MAX_ORDERS,
  MAX_STAFF,
  PENALTY_PERCENT,
  SALVAGE_PERCENT,
  WAGE,
  type Command,
  type Game,
  type ProductId,
} from "../src/workshop.ts";
import {
  CorruptSave,
  openSave,
  resetSave,
  transact,
  type Save,
} from "./storage.ts";
import { scene } from "./scene.ts";

const routes = {
  panel: "Ana panel",
  fabrikam: "Fabrikam",
  depo: "Depo",
  uretim: "Üretim",
  piyasa: "Piyasa",
  siparisler: "Siparişler",
  finans: "Finans",
  sirket: "Şirketim",
} as const;
type Page = keyof typeof routes;
/** Alt menüde beş grup; ilgili ekranlar grubun içinde sekme olarak açılır. */
const groups: { name: string; icon: string; pages: Page[] }[] = [
  {
    name: "Ana panel",
    icon: "M3 12l9-8 9 8 M5 10v10h14V10 M10 20v-6h4v6",
    pages: ["panel"],
  },
  {
    name: "Fabrikalar",
    icon: "M3 21V11l5 3v-3l5 3v-3l5 3V4h3v17z M7 17h2m4 0h2",
    pages: ["fabrikam", "depo"],
  },
  {
    name: "Üretim",
    icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10l2 2M5 19l2-2m10-10l2-2",
    pages: ["uretim"],
  },
  {
    name: "Piyasa",
    icon: "M4 19h16 M6 16l4-5 3 3 5-7 M15 7h3v3",
    pages: ["piyasa", "siparisler"],
  },
  {
    name: "Şirketim",
    icon: "M4 21V5l8-3 8 3v16 M9 21v-5h6v5 M8 8h2m4 0h2M8 12h2m4 0h2",
    pages: ["finans", "sirket"],
  },
];
const tabName: Partial<Record<Page, string>> = { piyasa: "Toptancı" };
type Tone = "ok" | "warn" | "bad" | "info";
const icon = (d: string) =>
  '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="' + d + '"/></svg>';
const glyph = {
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2",
  people:
    "M12 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6",
  lock: "M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4",
};
const nav = document.querySelector<HTMLElement>("#nav")!;
const screen = document.querySelector<HTMLElement>("#screen")!;
const message = document.querySelector<HTMLElement>("#message")!;
const dayLabel = document.querySelector<HTMLElement>("#day")!;
const fmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const money = (k: number) => fmt.format(k / 100) + " TL";
const signed = (k: number) =>
  (k > 0 ? "+" : k < 0 ? "−" : "") + money(Math.abs(k));
const secs = (ms: number) => Math.max(0, Math.ceil(ms / 1000));
const clock = (ms: number) => {
  const s = secs(ms);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};
const link = (to: Page, label: string) =>
  '<a class="cta" href="#' +
  to +
  '">' +
  label +
  ' <span aria-hidden="true">→</span></a>';
type Act = Exclude<Command, "finish" | "payroll" | "expire">;
const button = (
  cmd: Act,
  label: string,
  opts: {
    disabled?: boolean;
    qty?: number;
    kind?: string;
    hint?: string;
    product?: ProductId;
    id?: string;
  } = {},
) =>
  '<div class="action"><button data-cmd="' +
  cmd +
  '" data-qty="' +
  (opts.qty ?? 1) +
  '"' +
  (opts.product ? ' data-product="' + opts.product + '"' : "") +
  (opts.id ? ' data-id="' + opts.id + '"' : "") +
  (opts.kind ? ' class="' + opts.kind + '"' : "") +
  (opts.disabled ? " disabled" : "") +
  ">" +
  label +
  "</button>" +
  (opts.hint ? "<small>" + opts.hint + "</small>" : "") +
  "</div>";
const line = (label: string, value: string | number, kind = "") =>
  '<div class="line' +
  (kind ? " " + kind : "") +
  '"><dt>' +
  label +
  "</dt><dd>" +
  value +
  "</dd></div>";
const card = (title: string, body: string, extra = "") =>
  '<section class="card' +
  (extra ? " " + extra : "") +
  '"><h2>' +
  title +
  "</h2>" +
  body +
  "</section>";
const stat = (label: string, value: string, sub = "", tone: Tone | "" = "") =>
  '<div class="stat' +
  (tone ? " " + tone : "") +
  '"><span>' +
  label +
  "</span><strong>" +
  value +
  "</strong>" +
  (sub ? "<small>" + sub + "</small>" : "") +
  "</div>";
const badge = (text: string, tone: Tone) =>
  '<b class="badge ' + tone + '">' + text + "</b>";
const names: Record<Command | "opening", string> = {
  opening: "Açılış sermayesi",
  buy: "Ham madde alımı",
  hire: "Çalışan alındı · ilk gün maaşı",
  fire: "Çalışan ayrıldı",
  assign: "Hatta atama",
  unassign: "Hattan çekme",
  start: "Enerji ve paketleme",
  sell: "Toptancı tahsilatı",
  finish: "Mamuller depoya girdi",
  upgrade: "Makine yatırımı",
  payroll: "Günlük maaş ödemesi",
  salvage: "Malzeme elden çıkarıldı",
  accept: "Sipariş kabul edildi",
  decline: "Teklif reddedildi",
  counter: "Karşı teklif",
  reserve: "Siparişe stok ayrıldı",
  deliver: "Sipariş tahsilatı",
  expire: "Sözleşme cezası",
};
let db: IDBDatabase;
let state: Save;
let busy = false;
let shownDay = 0;
let lastTap = { command: "", at: -Infinity };
let channel: BroadcastChannel | undefined;
let broken = false;
let keepMessage = false;
let selected: ProductId = "chair";
try {
  const saved = localStorage.getItem("fabrikator:urun") as ProductId | null;
  if (saved && Object.hasOwn(catalog, saved)) selected = saved;
} catch {
  /* Tercih yalnız kolaylıktır. */
}

function page(): Page {
  const hash = location.hash.slice(1);
  return Object.hasOwn(routes, hash) ? (hash as Page) : "panel";
}
const nextDayIn = (g: Game, now: number) =>
  g.born + day(g, now) * DAY - Math.max(now, g.last);
const dueIn = (g: Game, dueDay: number, now: number) =>
  g.born + dueDay * DAY - Math.max(now, g.last);
const openProducts = (g: Game) => products.filter((p) => !lockReason(g, p));
const product = (g: Game) => (lockReason(g, selected) ? "chair" : selected);
const totalGoods = (g: Game) =>
  products.reduce((n, p) => n + g.goods[p].qty, 0);
const plural = (n: number, p: ProductId) => n + " " + catalog[p].short;
/** Açık siparişlerin henüz ayrılmamış ihtiyacı; toptancıya satılırsa sipariş tehlikeye girer. */
const owed = (g: Game, p: ProductId) =>
  g.orders
    .filter((o) => o.product === p)
    .reduce((n, o) => n + o.qty - o.reserved, 0);
const spare = (g: Game, p: ProductId) =>
  Math.max(0, available(g, p) - owed(g, p));

type Note = { tone: Tone; text: string; to: Page; cta: string };
/** Oyuncuya sıradaki mantıklı adımı ve darboğazları söyler (önem sırasıyla). */
function advice(g: Game, now: number): Note[] {
  const notes: Note[] = [];
  const idle = g.staff - g.workers,
    free = seats(g.level) - g.workers;
  const today = day(g, now);
  for (const o of g.orders) {
    const ready = o.reserved + available(g, o.product) >= o.qty;
    if (ready)
      notes.push({
        tone: "ok",
        text:
          customers[o.customer].name +
          " siparişi teslime hazır: " +
          plural(o.qty, o.product) +
          ".",
        to: "siparisler",
        cta: "Teslim et",
      });
    else
      notes.push({
        tone: o.dueDay === today ? "bad" : "warn",
        text:
          customers[o.customer].name +
          " siparişi için " +
          plural(o.qty - o.reserved - available(g, o.product), o.product) +
          " eksik" +
          (o.dueDay === today
            ? "; son gün bugün."
            : " (" + (o.dueDay - today) + " gün kaldı)."),
        to: "uretim",
        cta: "Üret",
      });
  }
  if (g.job)
    notes.push({
      tone: "info",
      text:
        "Hatta " +
        plural(g.job, g.jobProduct || "chair") +
        " üretiliyor. " +
        secs(g.ready - now) +
        " sn sonra depoya girer.",
      to: "uretim",
      cta: "Üretimi izle",
    });
  if (g.offers.length)
    notes.push({
      tone: "info",
      text: g.offers.length + " yeni müşteri teklifi bekliyor.",
      to: "siparisler",
      cta: "Teklifler",
    });
  // Açık siparişlerin ihtiyacı satılabilir sayılmaz.
  const sellable = products.filter(
    (p) => spare(g, p) && market(g, now, p).demand,
  );
  if (sellable.length)
    notes.push({
      tone: "ok",
      text:
        "Siparişlerden artan, satışa hazır " +
        sellable.map((p) => plural(spare(g, p), p)).join(", ") +
        " var.",
      to: "piyasa",
      cta: "Toptancıya git",
    });
  if (!g.job && !g.staff)
    notes.push({
      tone: "bad",
      text: "Atölyede hiç çalışan yok. Üretim için montaj çalışanı alın.",
      to: "fabrikam",
      cta: "Çalışan al",
    });
  else if (!g.job && !g.workers)
    notes.push({
      tone: "bad",
      text: "Üretim durdu: hatta çalışan yok. Boştaki çalışanı hatta atayın.",
      to: "fabrikam",
      cta: "Ekibi düzenle",
    });
  const canMake = openProducts(g).filter((p) => lotsOf(g, p));
  if (!g.job && !canMake.length)
    notes.push({
      tone: "bad",
      text: "Ham madde yok; üretim yapılamaz. Depodan malzeme alın.",
      to: "depo",
      cta: "Ham madde al",
    });
  else if (!g.job && g.workers)
    notes.push({
      tone: "ok",
      text:
        "Hat hazır: " +
        canMake.map((p) => catalog[p].short).join(", ") +
        " üretilebilir.",
      to: "uretim",
      cta: "Üretime başla",
    });
  if (idle > 0)
    notes.push({
      tone: "warn",
      text:
        "Boşta " +
        idle +
        " çalışan var; hatta değilken de günlük " +
        money(WAGE) +
        " maaş alıyor.",
      to: "fabrikam",
      cta: "Hatta ata",
    });
  if (!g.job && free > 0 && idle === 0 && g.staff < MAX_STAFF && g.staff)
    notes.push({
      tone: "info",
      text:
        "Hatta " +
        free +
        " boş koltuk var. Yeni çalışan çevrimi hızlandırır ama günlük maaşı artırır.",
      to: "fabrikam",
      cta: "Personel",
    });
  for (const p of products) {
    const u = catalog[p].unlock;
    if (u?.rep && g.rep < u.rep && g.rep >= u.rep - 5)
      notes.push({
        tone: "info",
        text:
          catalog[p].name +
          " üretimine " +
          (u.rep - g.rep) +
          " itibar kaldı. Siparişleri zamanında teslim edin.",
        to: "siparisler",
        cta: "Siparişler",
      });
  }
  if (
    g.level < 3 &&
    !g.job &&
    profit(g) - g.investment >= upgradePrice(g) &&
    g.cash >= upgradePrice(g)
  )
    notes.push({
      tone: "info",
      text: "Birikmiş kazancın makine geliştirmeye yetiyor: kapasite, koltuk ve yeni ürün.",
      to: "fabrikam",
      cta: "Makineye bak",
    });
  return notes;
}

function panel(g: Game, now: number) {
  const running = !!g.job,
    notes = advice(g, now);
  const top = notes.find((n) => n.tone !== "info") ?? notes[0];
  const left = Math.min(duration(g), Math.max(0, g.ready - now));
  const status = running
    ? badge("Hat çalışıyor", "ok")
    : g.workers && canStart(g)
      ? badge("Hat hazır", "warn")
      : badge("Hat durdu", "bad");
  const last = state.log[0];
  return (
    '<section class="hero"><div class="scene">' +
    scene(g, running) +
    "</div>" +
    '<div class="hero-copy">' +
    status +
    "<h2>Mobilya atölyesi</h2><p>Montaj hattı · Seviye " +
    g.level +
    " · " +
    g.workers +
    "/" +
    seats(g.level) +
    " koltuk dolu · İtibar " +
    g.rep +
    "</p>" +
    (running
      ? '<div class="meter"><i id="hero-bar" style="width:' +
        (100 * (1 - left / duration(g))).toFixed(1) +
        '%"></i></div>'
      : "") +
    (top
      ? '<p class="hint ' +
        top.tone +
        '">' +
        top.text +
        "</p>" +
        link(top.to, top.cta)
      : "") +
    "</div></section>" +
    '<div class="stats">' +
    stat(
      "Kasa",
      money(g.cash),
      "Faaliyet kârı " + signed(profit(g)),
      profit(g) < 0 ? "warn" : "ok",
    ) +
    stat(
      "Üretim",
      running ? plural(g.job, g.jobProduct || "chair") : "Bekliyor",
      running
        ? '<span id="hero-left">' + secs(left) + " sn</span> kaldı"
        : g.materials.board.qty + " tahta depoda",
      running ? "ok" : "warn",
    ) +
    stat(
      "Personel",
      g.workers + " hatta · " + (g.staff - g.workers) + " boşta",
      "Toplam " + g.staff + " · " + money(g.staff * WAGE) + "/gün",
      g.staff - g.workers ? "warn" : "",
    ) +
    stat(
      "Siparişler",
      g.orders.length + " açık",
      g.offers.length + " yeni teklif · itibar " + g.rep,
      g.orders.length ? "ok" : "",
    ) +
    "</div>" +
    card(
      "Yönetici notları",
      notes.length
        ? '<ul class="notes">' +
            notes
              .map(
                (n) =>
                  '<li class="' +
                  n.tone +
                  '"><span>' +
                  n.text +
                  '</span><a href="#' +
                  n.to +
                  '">' +
                  n.cta +
                  " ›</a></li>",
              )
              .join("") +
            "</ul>"
        : "<p>Her şey yolunda.</p>",
    ) +
    card(
      "Bugün",
      '<div class="grid2">' +
        stat(
          "Oyun günü",
          "Gün " + day(g, now),
          '<span id="next-day">' +
            clock(nextDayIn(g, now)) +
            "</span> sonra yeni gün",
        ) +
        stat(
          "Mamul stok",
          totalGoods(g) + " adet",
          openProducts(g)
            .map((p) => plural(g.goods[p].qty, p))
            .join(" · "),
        ) +
        stat(
          "Personel gideri",
          money(g.staff * WAGE) + "/gün",
          g.staff + " çalışan × " + money(WAGE),
        ) +
        stat(
          "Son işlem",
          names[last.kind] ?? last.kind,
          signed(last.movement),
        ) +
        "</div>",
    )
  );
}
const canStart = (g: Game) => openProducts(g).some((p) => lotsOf(g, p));

function crew(g: Game) {
  const n = seats(g.level);
  let out =
    '<div class="crew" aria-hidden="true"><div><small>Hat koltukları</small><p>';
  for (let i = 0; i < n; i++)
    out +=
      '<span class="seat' +
      (i < g.workers ? " on" : "") +
      '">' +
      icon(glyph.people) +
      "</span>";
  out += "</p></div><div><small>Mola alanı</small><p>";
  for (let i = 0; i < g.staff - g.workers; i++)
    out += '<span class="seat idle">' + icon(glyph.people) + "</span>";
  if (g.staff === g.workers) out += "<em>boş</em>";
  return out + "</p></div></div>";
}

function factory(g: Game) {
  const idle = g.staff - g.workers,
    n = seats(g.level);
  const now1 = cycle(g.level, 1, g.workers),
    plus1 = cycle(g.level, 1, g.workers + 1);
  const p = upgradePrice(g),
    avail = profit(g) - g.investment;
  const crewHint = g.job
    ? "Üretim sürerken hat ekibi değişmez."
    : g.workers >= n
      ? "Hattaki " +
        n +
        " koltuk dolu. Daha fazla koltuk için makineyi geliştirin."
      : !idle
        ? "Boşta çalışan yok. Önce çalışan alın."
        : g.workers
          ? "Sandalye partisi " +
            secs(now1) +
            " sn → " +
            secs(plus1) +
            " sn olur."
          : "Hatta en az 1 çalışan olmadan üretim başlamaz.";
  const next = products
    .filter((x) => catalog[x].unlock?.level === g.level + 1)
    .map((x) => catalog[x].name);
  return (
    card(
      "Personel",
      '<p class="lead">Montaj çalışanları hattı işletir. Hattaki her çalışan çevrimi hızlandırır; makine seviyesi hatta kaç kişinin çalışabileceğini belirler. Her çalışan, hatta olmasa bile günlük ' +
        money(WAGE) +
        " maaş alır.</p>" +
        '<div class="grid4">' +
        stat(
          "Toplam çalışan",
          g.staff + " / " + MAX_STAFF,
          "atölye kapasitesi",
        ) +
        stat(
          "Hatta",
          g.workers + " / " + n,
          "aktif koltuk",
          g.workers ? "ok" : "bad",
        ) +
        stat(
          "Boşta",
          String(idle),
          idle ? "maaş alıyor" : "boşta kimse yok",
          idle ? "warn" : "",
        ) +
        stat(
          "Günlük maaş",
          money(g.staff * WAGE),
          money(WAGE) + " × " + g.staff,
        ) +
        "</div>" +
        crew(g) +
        '<div class="actions">' +
        button("hire", "Montaj çalışanı al · " + money(WAGE), {
          disabled: g.staff >= MAX_STAFF || g.cash < WAGE,
          hint:
            g.staff >= MAX_STAFF
              ? "Atölye en fazla " + MAX_STAFF + " çalışan alır."
              : "İlk günün maaşı şimdi ödenir; sonra her yeni gün kesilir.",
        }) +
        button("assign", "Hatta ata", {
          disabled: !!g.job || !idle || g.workers >= n,
          hint: crewHint,
        }) +
        button("unassign", "Hattan çek", {
          kind: "ghost",
          disabled: !!g.job || !g.workers,
          hint: g.workers
            ? "Hattan çekilen çalışan boşta bekler ve maaş almaya devam eder."
            : "0 çalışanla üretim başlatılamaz.",
        }) +
        button("fire", "Boştaki çalışanı çıkar", {
          kind: "danger",
          disabled: !idle,
          hint: idle
            ? "Maaş yükü azalır; ödenmiş maaş geri gelmez."
            : "Yalnız boştaki çalışan çıkarılabilir.",
        }) +
        "</div>",
    ) +
    card(
      "Montaj hattı · Seviye " + g.level,
      '<div class="grid4">' +
        stat(
          "Çevrim kapasitesi",
          g.level + " parti",
          "her parti bir çalışan ister",
        ) +
        stat("Hat koltuğu", String(n), "önerilen ekip: " + n) +
        stat(
          "Tek parti süresi",
          g.workers ? secs(now1) + " sn" : "—",
          g.workers
            ? "sandalye · " + g.workers + " çalışanla"
            : "hatta çalışan yok",
          g.workers ? "" : "bad",
        ) +
        stat(
          "Hat verimliliği",
          "%" + Math.round((100 * g.workers) / n),
          "dolu koltuk oranı",
          g.workers === n ? "ok" : "warn",
        ) +
        "</div>" +
        '<p class="small">Çevrim süresi = ürünün parti süresi × parti ÷ (makine seviyesi × hattaki çalışan).</p>',
    ) +
    card(
      "Makine yatırımı",
      g.level < 3
        ? '<table class="compare"><thead><tr><th></th><th>Şimdi</th><th>Seviye ' +
            (g.level + 1) +
            "</th></tr></thead><tbody>" +
            "<tr><td>Çevrimde parti</td><td>" +
            g.level +
            "</td><td>" +
            (g.level + 1) +
            "</td></tr>" +
            "<tr><td>Hat koltuğu</td><td>" +
            n +
            "</td><td>" +
            seats(g.level + 1) +
            "</td></tr>" +
            "<tr><td>Sandalye partisi · " +
            Math.max(1, g.workers) +
            " çalışan</td><td>" +
            secs(cycle(g.level, 1, g.workers)) +
            " sn</td><td>" +
            secs(cycle(g.level + 1, 1, g.workers)) +
            " sn</td></tr>" +
            (next.length
              ? "<tr><td>Yeni ürün</td><td>—</td><td>" +
                next.join(", ") +
                "</td></tr>"
              : "") +
            "</tbody></table>" +
            "<dl>" +
            line("Yatırım tutarı", money(p)) +
            line(
              "Yatırıma ayrılabilir kazanç",
              money(Math.max(0, avail)),
              avail >= p ? "good" : "",
            ) +
            "</dl>" +
            button("upgrade", "Makineyi geliştir · " + money(p), {
              disabled: !!g.job || g.cash < p || avail < p,
              hint: g.job
                ? "Hat çalışırken geliştirilemez."
                : avail < p
                  ? "Faaliyet kârından " +
                    money(p - Math.max(0, avail)) +
                    " daha birikmeli."
                  : "Yatırım kasadan çıkar; gider değil, varlık olarak kaydedilir.",
            })
        : "<p>En yüksek makine seviyesindesiniz.</p>",
    )
  );
}

function productTabs(g: Game) {
  return (
    '<div class="tabs" role="group" aria-label="Ürün seçimi">' +
    products
      .map((p) => {
        const lock = lockReason(g, p);
        return (
          '<button class="tab' +
          (p === product(g) ? " on" : "") +
          '" data-act="product" data-product="' +
          p +
          '"' +
          (lock ? ' disabled title="' + lock + '"' : "") +
          ' aria-pressed="' +
          (p === product(g)) +
          '">' +
          (lock ? icon(glyph.lock) : "") +
          catalog[p].name +
          (lock ? "<small>" + lock + "</small>" : "") +
          "</button>"
        );
      })
      .join("") +
    "</div>"
  );
}

function production(g: Game, now: number) {
  const pid = product(g),
    r = catalog[pid];
  const recipe = card(
    r.name + " reçetesi · " + r.group,
    '<div class="grid4">' +
      stat("Parti", r.batch + " adet") +
      stat(
        "Ham madde",
        r.boards + " tahta + " + r.kits + " set",
        money(r.materials),
      ) +
      stat("Enerji + paket", money(r.energy + r.packaging), "parti başına") +
      stat("Toptancı fiyatı", money(r.basePrice), "temel, adet") +
      "</div>",
  );
  if (g.job) {
    const total = duration(g),
      left = Math.min(total, Math.max(0, g.ready - now));
    return (
      card(
        "Hat çalışıyor",
        '<div class="countdown"><strong id="remaining">' +
          secs(left) +
          " sn</strong><span>" +
          plural(g.job, g.jobProduct || "chair") +
          " · " +
          g.workers +
          " çalışan</span></div>" +
          '<div class="meter big"><i id="bar" style="width:' +
          (100 * (1 - left / total)).toFixed(1) +
          '%"></i></div>' +
          "<dl>" +
          line("Üretimde", plural(g.job, g.jobProduct || "chair")) +
          line(
            "Depoya giriş",
            '<span id="remaining-line">' + secs(left) + " sn</span>",
          ) +
          line("Üretimdeki iş maliyeti", money(g.wip)) +
          "</dl>" +
          '<p class="small">Uygulama kapalıyken de üretim sürer; bitiş zamanı geçtiyse ilk açılışta mamuller depoya girer.</p>',
        "live",
      ) + recipe
    );
  }
  const plans = Array.from({ length: g.level }, (_, i) => {
    const lots = i + 1,
      units = lots * r.batch,
      time = cycle(g.level, lots, g.workers, pid);
    const have = lotsOf(g, pid);
    const material = lots * r.materials;
    const variable = lots * (r.energy + r.packaging);
    const labor = Math.round((Math.max(1, g.workers) * WAGE * time) / DAY);
    const cost = material + variable;
    const reason = !g.workers
      ? "Hatta çalışan yok. Fabrikam ekranından atayın."
      : lots > g.workers
        ? "Bu parti için hatta en az " + lots + " çalışan gerekir."
        : lots > have
          ? "Depoda " + lots + " parti malzeme gerekir (" + have + " var)."
          : g.cash < variable
            ? "Enerji ve paketleme için kasa yetersiz."
            : "";
    return (
      '<article class="plan' +
      (reason ? " off" : "") +
      '"><header><strong>' +
      plural(units, pid) +
      "</strong>" +
      badge(g.workers ? secs(time) + " sn" : "—", reason ? "bad" : "ok") +
      "</header><dl>" +
      line("Ham madde", lots + " parti · ≈" + money(material)) +
      line("Enerji + paketleme", money(variable)) +
      line("Üretim maliyeti", "≈" + money(cost)) +
      line("Birim maliyet", "≈" + money(Math.round(cost / units))) +
      line("İşçilik payı (tahmini)", money(labor)) +
      line("Depoya eklenecek", "+" + units + " adet", "good") +
      "</dl>" +
      button("start", plural(units, pid) + " üret · " + money(variable), {
        disabled: !!reason,
        qty: lots,
        product: pid,
        hint:
          reason ||
          "Kasadan yalnız enerji ve paketleme çıkar; ham madde zaten ödendi.",
      }) +
      "</article>"
    );
  }).join("");
  return (
    productTabs(g) +
    card(
      "Üretim emri",
      '<p class="lead">Aktif çalışan: <b>' +
        g.workers +
        "</b> · Bu ürün için malzeme: <b>" +
        lotsOf(g, pid) +
        "</b> parti · Makine en fazla <b>" +
        g.level +
        "</b> parti alır.</p>" +
        '<div class="plans">' +
        plans +
        "</div>" +
        '<p class="small">Malzeme maliyeti depodaki ortalama maliyetle hesaplanır; işçilik maaş olarak her gün kesilir.</p>',
    ) +
    recipe
  );
}

function warehouse(g: Game) {
  const pid = product(g),
    r = catalog[pid];
  const need = Math.max(1, maxLots(g)),
    have = lotsOf(g, pid);
  const tone: Tone = !have ? "bad" : have < need ? "warn" : "ok";
  return (
    productTabs(g) +
    card(
      "Ham madde " +
        badge(
          !have ? r.short + " için yok" : have < need ? "Kritik" : "Yeterli",
          tone,
        ),
      '<div class="grid2">' +
        stat(
          "Tahta",
          g.materials.board.qty + " adet",
          money(g.materials.board.cost),
        ) +
        stat(
          "Bağlantı seti",
          g.materials.kit.qty + " set",
          money(g.materials.kit.cost),
        ) +
        "</div>" +
        '<div class="meter ' +
        tone +
        '"><i style="width:' +
        Math.min(100, (100 * have) / Math.max(need, 4)).toFixed(0) +
        '%"></i></div>' +
        "<dl>" +
        line(r.name + " için", have + " parti · " + have * r.batch + " adet") +
        "</dl>" +
        button("buy", r.name + " partisi al · " + money(r.materials), {
          disabled: g.cash < r.materials,
          product: pid,
          hint:
            g.cash < r.materials
              ? "Kasa yetersiz."
              : r.boards +
                " tahta ve " +
                r.kits +
                " bağlantı seti. Para şimdi çıkar; maliyet satışta giderleşir.",
        }) +
        (have
          ? button(
              "salvage",
              "Bir parti malzemeyi elden çıkar · %" + SALVAGE_PERCENT,
              {
                kind: "danger",
                product: pid,
                hint:
                  "Kasa sıkışırsa kurtarma yolu: kayıtlı maliyetin %" +
                  SALVAGE_PERCENT +
                  "'ı geri gelir, fark zarar yazılır.",
              },
            )
          : ""),
    ) +
    (g.job
      ? card(
          "Üretimde",
          "<dl>" +
            line("Montaj hattında", plural(g.job, g.jobProduct || "chair")) +
            line("Maliyet", money(g.wip)) +
            "</dl>",
        )
      : "") +
    card(
      "Mamul deposu " +
        (totalGoods(g) ? badge("Satışa hazır", "ok") : badge("Boş", "info")),
      products
        .filter((p) => !lockReason(g, p) || g.goods[p].qty)
        .map((p) => {
          const s = g.goods[p];
          return (
            "<dl>" +
            line(catalog[p].name, s.qty + " adet") +
            line(
              "Satılabilir · siparişe ayrılan",
              available(g, p) + " · " + s.reserved,
            ) +
            line(
              "Ortalama birim maliyet",
              s.qty ? money(Math.round(s.cost / s.qty)) : "—",
            ) +
            "</dl>"
          );
        })
        .join('<hr class="soft">') +
        (totalGoods(g) ? link("piyasa", "Toptancıya sat") : ""),
    )
  );
}

function trade(g: Game, now: number) {
  // Kilidi itibar düşüşüyle yeniden kapanan ürünün stoğu yine de satılabilir.
  const cards = products
    .filter((p) => !lockReason(g, p) || g.goods[p].qty)
    .map((pid) => {
      const r = catalog[pid],
        q = market(g, now, pid),
        // Açık siparişlerin ihtiyacı toptancı düğmelerine konmaz.
        n = Math.min(spare(g, pid), q.demand);
      const tomorrow = market(
        { ...g, marketDay: 0 },
        Math.max(now, g.last) + nextDayIn(g, now),
        pid,
      );
      const quote = (k: number) => {
        const s = g.goods[pid];
        const gross = k * q.price,
          tax = Math.round((gross * 5) / 100),
          freight = k * r.shippingPerUnit;
        const basis = s.qty ? Math.round((s.cost * k) / s.qty) : 0;
        return {
          gross,
          tax,
          freight,
          net: gross - tax - freight,
          basis,
          gain: gross - tax - freight - basis,
        };
      };
      const options = [...new Set([n, Math.min(n, 10), Math.ceil(n / 2)])]
        .filter((k) => k > 0)
        .sort((a, b) => b - a);
      const all = quote(n);
      return card(
        r.name,
        '<div class="grid2">' +
          stat("Fiyat", money(q.price), "adet başına") +
          stat(
            "Kalan talep",
            q.demand + " adet",
            "yarın " +
              money(tomorrow.price) +
              " · " +
              tomorrow.demand +
              " adet",
            q.demand ? "ok" : "warn",
          ) +
          "</div>" +
          "<dl>" +
          line(
            "Satılabilir stok",
            available(g, pid) +
              " adet" +
              (g.goods[pid].reserved
                ? " (" + g.goods[pid].reserved + " siparişe ayrıldı)"
                : ""),
          ) +
          (owed(g, pid)
            ? line(
                "Açık siparişlerin ihtiyacı",
                owed(g, pid) + " adet · satarsanız teslim gecikebilir",
                "bad",
              )
            : "") +
          (n
            ? line("Kasaya girecek (" + n + ")", money(all.net)) +
              line(
                "Satış kârı (" + n + ")",
                signed(all.gain),
                all.gain >= 0 ? "good" : "bad",
              )
            : "") +
          "</dl>" +
          (n
            ? '<div class="actions">' +
              options
                .map((k) =>
                  button(
                    "sell",
                    k + " " + r.acc + " sat · +" + money(quote(k).net),
                    { qty: k, product: pid, kind: k === n ? "" : "ghost" },
                  ),
                )
                .join("") +
              "</div>"
            : button(
                "sell",
                !available(g, pid)
                  ? "Satılacak " + r.short + " yok"
                  : !spare(g, pid)
                    ? "Stok açık siparişler için tutuluyor"
                    : "Yeni günün teklifini bekle",
                {
                  disabled: true,
                  product: pid,
                  hint: !available(g, pid)
                    ? "Önce üretim yapın."
                    : !spare(g, pid)
                      ? "Siparişleri teslim edin ya da fazlasını üretin."
                      : "Bugünkü talep doldu.",
                },
              )),
      );
    });
  return (
    card(
      "Toptancı",
      '<p class="lead">Hızlı nakit, düşük marj. Her ürünün günlük alım sınırı var; yeni teklif <b id="quote-time">' +
        clock(nextDayIn(g, now)) +
        "</b> sonra. Satıştan %5 oyun vergisi ve adet başına nakliye düşülür.</p>",
    ) + cards.join("")
  );
}

function orders(g: Game, now: number) {
  const today = day(g, now),
    full = g.orders.length >= MAX_ORDERS;
  const active = g.orders.map((o) => {
    const r = catalog[o.product],
      have = available(g, o.product),
      missing = o.qty - o.reserved - have;
    const tax = Math.round((o.price * 5) / 100),
      net = o.price - tax - o.shipping;
    return (
      '<article class="order">' +
      "<header><strong>" +
      customers[o.customer].name +
      "</strong>" +
      badge(
        o.dueDay === today ? "Son gün" : o.dueDay - today + " gün",
        o.dueDay === today ? "bad" : "info",
      ) +
      "</header>" +
      "<dl>" +
      line("Ürün", plural(o.qty, o.product) + " · " + r.name) +
      line("Sözleşme bedeli", money(o.price)) +
      line(
        "Teslim süresi",
        '<span data-due="' +
          o.dueDay +
          '">' +
          clock(dueIn(g, o.dueDay, now)) +
          "</span>",
      ) +
      line(
        "Kasaya girecek",
        money(net) +
          " (vergi " +
          money(tax) +
          ", nakliye " +
          money(o.shipping) +
          ")",
      ) +
      "</dl>" +
      '<div class="meter ' +
      (o.reserved === o.qty ? "" : missing > 0 ? "warn" : "") +
      '"><i style="width:' +
      ((100 * o.reserved) / o.qty).toFixed(0) +
      '%"></i></div>' +
      '<p class="small">Ayrılan ' +
      o.reserved +
      "/" +
      o.qty +
      " · depoda hazır " +
      have +
      (missing > 0 ? " · <b>" + missing + " adet eksik</b>" : "") +
      ". Teslim edilmezse " +
      money(Math.round((o.price * PENALTY_PERCENT) / 100)) +
      " ceza ve −" +
      2 * o.rep +
      " itibar.</p>" +
      '<div class="actions">' +
      button("deliver", "Teslim et · +" + money(net), {
        id: o.id,
        disabled: missing > 0,
        hint:
          missing > 0
            ? "Teslim için " + missing + " adet daha üretin."
            : "Eksik kalan adet depodan otomatik ayrılır.",
      }) +
      button("reserve", "Stoktan ayır", {
        id: o.id,
        kind: "ghost",
        disabled: o.reserved >= o.qty || have < 1,
        hint: "Ayrılan ürün toptancıya satılmaz.",
      }) +
      "</div></article>"
    );
  });
  const offers = g.offers.map((o) => {
    const r = catalog[o.product],
      gain = offerGain(g, o),
      unit = o.price / o.qty,
      ws = market(g, now, o.product).price;
    const tone: Tone = gain < 0 ? "bad" : gain < o.price * 0.15 ? "warn" : "ok";
    return (
      '<article class="offer">' +
      "<header><strong>" +
      customers[o.customer].name +
      "</strong>" +
      badge(
        gain < 0 ? "Zararlı" : tone === "warn" ? "Düşük kâr" : "Kârlı",
        tone,
      ) +
      "</header>" +
      "<dl>" +
      line("Talep", plural(o.qty, o.product) + " · " + r.name) +
      line(
        "Teklif",
        money(o.price) + " · " + money(Math.round(unit)) + "/adet",
      ) +
      line("Toptancı bugün", money(ws) + "/adet") +
      line(
        "Teslim",
        o.dueDay - today + " gün · Gün " + o.dueDay + " sonuna kadar",
      ) +
      line("Nakliye", "−" + money(o.shipping), "neg") +
      line("İtibar", "+" + o.rep) +
      line(
        "Tahmini net kazanç",
        signed(gain),
        gain >= 0 ? "total good" : "total bad",
      ) +
      "</dl>" +
      '<div class="actions">' +
      button("accept", "Kabul et", {
        id: o.id,
        disabled: full,
        hint: full
          ? "En fazla " + MAX_ORDERS + " açık sipariş."
          : "Kabul edilen sipariş teslim yükümlülüğü doğurur.",
      }) +
      button("counter", "Karşı teklif · " + money(counterPrice(o)), {
        id: o.id,
        kind: "ghost",
        disabled: full,
        hint: "Tek hak: müşteri ya kabul eder ya da çekilir.",
      }) +
      button("decline", "Reddet", { id: o.id, kind: "danger" }) +
      "</div></article>"
    );
  });
  return (
    '<div class="stats">' +
    stat(
      "İtibar",
      g.rep + " / 100",
      g.rep < 15 ? "15'te yemek masası açılır" : "zamanında teslim artırır",
      g.rep >= 15 ? "ok" : "warn",
    ) +
    stat(
      "Açık sipariş",
      g.orders.length + " / " + MAX_ORDERS,
      "teslim edilen " + g.delivered,
    ) +
    stat(
      "Bugünkü teklif",
      String(g.offers.length),
      '<span id="next-day">' +
        clock(nextDayIn(g, now)) +
        "</span> sonra yenisi",
    ) +
    stat(
      "Ödenen ceza",
      money(g.penalties),
      "gecikmiş siparişler",
      g.penalties ? "bad" : "",
    ) +
    "</div>" +
    card(
      "Açık siparişler",
      active.length
        ? '<div class="plans">' + active.join("") + "</div>"
        : "<p>Açık sipariş yok. Aşağıdaki tekliflerden birini kabul edin.</p>",
    ) +
    card(
      "Müşteri teklifleri",
      (offers.length
        ? '<div class="plans">' + offers.join("") + "</div>"
        : "<p>Bugünün tekliflerini yanıtladınız. Yeni teklifler yarın gelir.</p>") +
        '<p class="small">Tahmini net kazanç: bedel − %5 vergi − nakliye − üretim maliyeti (depodaki ortalama ya da liste maliyeti).</p>',
    )
  );
}

function finance(g: Game) {
  const margin = g.income ? Math.round((100 * profit(g)) / g.income) : 0;
  return (
    '<div class="stats">' +
    stat("Kasa", money(g.cash)) +
    stat(
      "Faaliyet kârı",
      signed(profit(g)),
      g.income ? "marj %" + margin : "henüz satış yok",
      profit(g) >= 0 ? "ok" : "bad",
    ) +
    stat("Satılan", g.sold + " adet", g.delivered + " sipariş teslim") +
    stat("Ödenen maaş", money(g.wages), g.staff + " çalışan bordroda") +
    "</div>" +
    card(
      "Gelir tablosu",
      "<dl>" +
        line("Satış geliri", money(g.income)) +
        line("Satılan ürün maliyeti", "−" + money(g.cogs), "neg") +
        line("Brüt kâr", signed(g.income - g.cogs), "total") +
        line("Nakliye", "−" + money(g.freight), "neg") +
        line("Oyun vergisi", "−" + money(g.tax), "neg") +
        line("Sabit gider öncesi kazanç", signed(salesProfit(g)), "total") +
        line("İşçilik gideri", "−" + money(g.wages), "neg") +
        line("Sözleşme cezaları", "−" + money(g.penalties), "neg") +
        line("Stok değer kaybı", "−" + money(g.writeoffs), "neg") +
        line(
          "Faaliyet kârı",
          signed(profit(g)),
          profit(g) >= 0 ? "total good" : "total bad",
        ) +
        "</dl>" +
        '<p class="small">Satılan ürün maliyeti ham madde, enerji ve paketlemeden oluşur. Makine yatırımı gider değil, varlıktır.</p>',
    ) +
    card(
      "Varlıklar",
      "<dl>" +
        line("Kasa", money(g.cash)) +
        line(
          "Ham madde stoku",
          money(g.materials.board.cost + g.materials.kit.cost),
        ) +
        line("Üretimdeki iş", money(g.wip)) +
        line(
          "Mamul stoku",
          money(stockValue(g) - g.materials.board.cost - g.materials.kit.cost),
        ) +
        line("Makine yatırımları", money(g.investment)) +
        line("Toplam", money(CAPITAL + profit(g)), "total") +
        "</dl>",
    ) +
    card(
      "Son hareketler",
      '<dl class="log">' +
        state.log
          .map((e) =>
            line(
              names[e.kind] ?? e.kind,
              signed(e.movement),
              e.movement > 0 ? "good" : e.movement < 0 ? "neg" : "",
            ),
          )
          .join("") +
        "</dl>",
    ) +
    card(
      "Kayıt",
      "<p>İlerleme yalnızca bu tarayıcıda saklanır; bulut yedeği yoktur. Safari site verilerini silerse kayıt da silinir.</p>" +
        '<button class="danger" data-act="reset">Yeni oyun başlat</button>',
    )
  );
}

function company(g: Game) {
  const soon: [string, string, string][] = [
    [
      "Banka ve kredi",
      "Kredi notu, işletme kredisi, taksit ve faiz",
      "Paket 2",
    ],
    ["Borsa", "Kurgusal hisseler, portföy ve kâr/zarar", "Paket 3"],
    ["Mobilya kataloğu", "Altı ürün grubu, kalite ve tedarikçiler", "Paket 4"],
    ["Satış kanalları", "Mağaza, e-ticaret, ihracat, açık artırma", "Paket 5"],
    ["Rakipler", "Rakip şirketler, fiyat savaşı ve krizler", "Paket 6"],
    ["Yatırımlar", "Arsa, yeni fabrika, AVM dükkânı", "Paket 7"],
    ["Yeni sektörler", "Gıda, otomotiv, tekstil ve diğerleri", "Paket 8"],
    ["Holding", "Şirket satın alma ve halka arz", "Paket 9"],
    ["Araştırma", "Teknoloji ağacı, görevler ve başarımlar", "Paket 10"],
  ];
  return (
    '<div class="stats">' +
    stat("Şirket değeri", money(CAPITAL + profit(g)), "özkaynak") +
    stat(
      "İtibar",
      g.rep + " / 100",
      g.delivered + " sipariş teslim",
      g.rep >= 15 ? "ok" : "warn",
    ) +
    stat(
      "Ürünler",
      openProducts(g).length + " / " + products.length,
      "açık ürün",
    ) +
    stat("Tesis", "1 atölye", "makine seviyesi " + g.level) +
    "</div>" +
    card(
      "Ürün yelpazesi",
      "<dl>" +
        products
          .map((p) =>
            line(
              catalog[p].name + " · " + catalog[p].group,
              lockReason(g, p) || "Üretimde",
              lockReason(g, p) ? "" : "good",
            ),
          )
          .join("") +
        "</dl>",
    ) +
    card(
      "Gelişim yol haritası",
      '<p class="lead">Bu bölümler henüz açık değil; her biri ilgili geliştirme paketiyle oynanabilir hâle gelecek.</p><ul class="locked">' +
        soon
          .map(
            ([t, d, k]) =>
              "<li>" +
              icon(glyph.lock) +
              "<div><b>" +
              t +
              "</b><small>" +
              d +
              "</small></div><em>" +
              k +
              "</em></li>",
          )
          .join("") +
        "</ul>",
    )
  );
}

function contents(view: Page, g: Game, now: number) {
  switch (view) {
    case "panel":
      return panel(g, now);
    case "fabrikam":
      return factory(g);
    case "depo":
      return warehouse(g);
    case "uretim":
      return production(g, now);
    case "piyasa":
      return trade(g, now);
    case "siparisler":
      return orders(g, now);
    case "finans":
      return finance(g);
    case "sirket":
      return company(g);
  }
}
const groupOf = (view: Page) => groups.find((x) => x.pages.includes(view))!;

function render() {
  const now = Date.now(),
    g = state.game,
    view = page(),
    group = groupOf(view);
  shownDay = day(g, now);
  dayLabel.innerHTML =
    '<span class="chip">' +
    icon(glyph.clock) +
    "Gün " +
    String(shownDay).padStart(2, "0") +
    '</span><span class="chip cash">' +
    money(g.cash) +
    "</span>";
  nav.innerHTML = groups
    .map((x) => {
      const badgeCount =
        x.name === "Piyasa"
          ? g.offers.length +
            g.orders.filter(
              (o) => o.reserved + available(g, o.product) >= o.qty,
            ).length
          : 0;
      return (
        '<a href="#' +
        x.pages[0] +
        '" ' +
        (x === group ? 'aria-current="page"' : "") +
        ">" +
        icon(x.icon) +
        x.name +
        (badgeCount ? '<i class="dot">' + badgeCount + "</i>" : "") +
        "</a>"
      );
    })
    .join("");
  const sub =
    group.pages.length > 1
      ? '<nav class="subnav" aria-label="Bölüm">' +
        group.pages
          .map(
            (p) =>
              '<a href="#' +
              p +
              '" ' +
              (p === view ? 'aria-current="page"' : "") +
              ">" +
              (tabName[p] ?? routes[p]) +
              (p === "siparisler" && g.offers.length
                ? " · " + g.offers.length
                : "") +
              "</a>",
          )
          .join("") +
        "</nav>"
      : "";
  screen.innerHTML =
    sub + "<h1>" + routes[view] + "</h1>" + contents(view, g, now);
  screen.setAttribute("aria-busy", "false");
  timers(now);
}

function timers(now: number) {
  const g = state.game;
  const total = duration(g),
    left = Math.min(total, Math.max(0, g.ready - now));
  const done = (100 * (1 - left / total)).toFixed(1) + "%";
  for (const id of ["remaining", "remaining-line", "hero-left"]) {
    const el = document.getElementById(id);
    if (el) el.textContent = secs(left) + " sn";
  }
  for (const id of ["bar", "hero-bar"]) {
    const el = document.getElementById(id);
    if (el) el.style.width = done;
  }
  for (const id of ["quote-time", "next-day"]) {
    const el = document.getElementById(id);
    if (el) el.textContent = clock(nextDayIn(g, now));
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-due]"))
    el.textContent = clock(dueIn(g, Number(el.dataset.due), now));
}

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
    keepMessage = location.hash !== "#panel";
    location.hash = "panel";
    message.textContent = "Yeni oyun başladı.";
    message.dataset.tone = "ok";
    channel?.postMessage(state.game.rev);
  } catch {
    message.textContent =
      "Yeni oyun başlatılamadı. Sayfayı yenileyip tekrar dene.";
  } finally {
    busy = false;
    if (!broken) render();
  }
}
const done: Partial<Record<Command, string>> = {
  buy: "Ham madde depoya girdi.",
  hire: "Yeni montaj çalışanı işe başladı. Hatta atamayı unutmayın.",
  fire: "Çalışan ayrıldı; günlük maaş yükü azaldı.",
  assign: "Çalışan hatta yerini aldı.",
  unassign: "Çalışan hattan çekildi ve boşta bekliyor.",
  start: "Üretim başladı.",
  sell: "Satış tamamlandı, tahsilat kasada.",
  upgrade: "Makine geliştirildi.",
  salvage: "Malzeme elden çıkarıldı; tahsilat kasada.",
  accept: "Sipariş kabul edildi. Teslim tarihine dikkat edin.",
  decline: "Teklif reddedildi.",
  reserve: "Stok siparişe ayrıldı.",
  deliver: "Sipariş teslim edildi, tahsilat kasada ve itibar arttı.",
};
screen.addEventListener("click", async (event) => {
  const el = event.target as HTMLElement;
  const act = el.closest<HTMLButtonElement>("button[data-act]");
  if (act?.dataset.act === "reset" && !busy && db) return void reset();
  if (act?.dataset.act === "product" && !act.disabled) {
    selected = act.dataset.product as ProductId;
    try {
      localStorage.setItem("fabrikator:urun", selected);
    } catch {
      /* yok sayılır */
    }
    return render();
  }
  const target = el.closest<HTMLButtonElement>("button[data-cmd]");
  if (!target || target.disabled || busy || !state) return;
  const cmd = target.dataset.cmd as Act;
  const tapTime = performance.now();
  // Aynı düğmeye çift dokunma yok sayılır; farklı miktar veya kayıt ayrı bir karardır.
  const key =
    cmd +
    ":" +
    target.dataset.qty +
    ":" +
    (target.dataset.product ?? "") +
    ":" +
    (target.dataset.id ?? "");
  if (key === lastTap.command && tapTime - lastTap.at < 450) return;
  lastTap = { command: key, at: tapTime };
  busy = true;
  target.disabled = true;
  const id = target.dataset.id;
  try {
    state = await transact(db, {
      command: cmd,
      revision: state.game.rev,
      born: state.game.born,
      quantity: Number(target.dataset.qty),
      product: target.dataset.product as ProductId | undefined,
      id,
      quoteDay: shownDay,
    });
    message.textContent =
      cmd === "counter"
        ? state.game.orders.some((o) => o.id === id)
          ? "Müşteri karşı teklifi kabul etti; sipariş açıldı."
          : "Müşteri karşı teklifi kabul etmedi ve tekliften çekildi."
        : (done[cmd] ?? names[cmd] + " kaydedildi.");
    message.dataset.tone =
      cmd === "counter" && !state.game.orders.some((o) => o.id === id)
        ? "bad"
        : "ok";
    channel?.postMessage(state.game.rev);
  } catch (error) {
    message.textContent =
      error instanceof Error ? error.message : "İşlem kaydedilemedi.";
    message.dataset.tone = "bad";
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
    // Yeni oyunun onay mesajı, kendi tetiklediği ekran değişiminde silinmez.
    if (!keepMessage) message.textContent = "";
    keepMessage = false;
    render();
    window.scrollTo(0, 0);
  }
});
window.addEventListener("pageshow", () => void refresh());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void refresh();
});
// /FABRIKATOR/depo gibi doğrudan bağlantılar (404.html veya çevrimdışı çalışan üzerinden)
// aynı ekranın hash adresine çevrilir; yenileme sunucu gerektirmez.
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
      message.textContent =
        "Kayıtlı atölyen yüklendi. Kaldığın yerden devam et.";
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel("fabrikator-workshop");
      channel.onmessage = () => void refresh();
    }
    window.setInterval(() => {
      if (!state || busy || broken || document.hidden) return;
      const now = Date.now(),
        g = state.game;
      // Biten üretim, yeni günün maaşı ve süresi geçen siparişler kayda işlenir.
      if ((g.ready && now >= g.ready) || g.paidDay < day(g, now))
        void refresh();
      else timers(now);
    }, 500);
  } catch {
    message.textContent =
      "Atölye açılamadı. Safari’de site verilerine izin verip tekrar dene.";
    screen.textContent = "";
  }
}
void start();

// Güncelleme: yeni sürüm arka planda iner ve devralır; oyuncu "Güncelle" deyince sayfa yenilenir.
// Kayıt IndexedDB'de kalır; güncelleme onu silmez veya değiştirmez.
const update = document.querySelector<HTMLElement>("#update");
function showUpdate(worker?: ServiceWorker | null) {
  if (!update) return;
  update.hidden = false;
  update.querySelector("button")!.onclick = () => {
    wantReload = true;
    // Bekleyen bir çalışan varsa önce devralsın; yoksa yeni sürüm zaten etkin.
    if (worker && worker.state === "installed")
      worker.postMessage("skip-waiting");
    else location.reload();
  };
}
function offerUpdate(worker: ServiceWorker | null) {
  if (worker && navigator.serviceWorker.controller) showUpdate(worker);
}
let wantReload = false;
if ("serviceWorker" in navigator) {
  // İlk kurulumda denetleyici yoktur; o zaman bildirim gösterilmez.
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (wantReload) location.reload();
    else if (hadController) showUpdate();
    hadController = true;
  });
  navigator.serviceWorker
    .register("./sw.js", { updateViaCache: "none" })
    .then((reg) => {
      offerUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => {
          if (w.state === "installed") offerUpdate(w);
        });
      });
      const check = () => void reg.update().catch(() => undefined);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) check();
      });
      window.setInterval(check, 15 * 60 * 1000);
    })
    .catch(() => {
      /* Çevrimiçi oyun IndexedDB'ye kaydetmeye devam eder. */
    });
}
