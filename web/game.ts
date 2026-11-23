import {
  cycle,
  day,
  duration,
  market,
  maxLots,
  profit,
  r,
  salesProfit,
  seats,
  upgradePrice,
  CAPITAL,
  DAY,
  MAX_STAFF,
  WAGE,
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
import { scene } from "./scene.ts";

const routes = {
  panel: "Ana panel",
  fabrikam: "Fabrikam",
  uretim: "Üretim",
  depo: "Depo",
  piyasa: "Piyasa",
  finans: "Finans",
} as const;
type Page = keyof typeof routes;
type Tone = "ok" | "warn" | "bad" | "info";
const marks: Record<Page, string> = {
  panel: "M3 12l9-8 9 8 M5 10v10h14V10 M10 20v-6h4v6",
  fabrikam: "M3 21V11l5 3v-3l5 3v-3l5 3V4h3v17z M7 17h2m4 0h2",
  uretim:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10l2 2M5 19l2-2m10-10l2-2",
  depo: "M3 8l9-5 9 5v12H3z M7 20v-7h10v7 M7 16h10",
  piyasa: "M4 19h16 M6 16l4-5 3 3 5-7 M15 7h3v3",
  finans: "M4 4v16h16 M8 16v-5m4 5V8m4 8v-3",
};
const icon = (d: string) =>
  '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="' + d + '"/></svg>';
const glyph = {
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2",
  people:
    "M12 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6",
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
const button = (
  cmd: Exclude<Command, "finish" | "payroll">,
  label: string,
  opts: { disabled?: boolean; qty?: number; kind?: string; hint?: string } = {},
) =>
  '<div class="action"><button data-cmd="' +
  cmd +
  '" data-qty="' +
  (opts.qty ?? 1) +
  '"' +
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
  sell: "Net satış tahsilatı",
  finish: "Mamuller depoya girdi",
  upgrade: "Makine yatırımı",
  payroll: "Günlük maaş ödemesi",
};
let db: IDBDatabase;
let state: Save;
let busy = false;
let shownDay = 0;
let lastTap = { command: "", at: -Infinity };
let channel: BroadcastChannel | undefined;
let broken = false;

function page(): Page {
  const hash = location.hash.slice(1);
  return Object.hasOwn(routes, hash) ? (hash as Page) : "panel";
}
const nextDayIn = (g: Game, now: number) =>
  g.born + day(g, now) * DAY - Math.max(now, g.last);

type Note = { tone: Tone; text: string; to: Page; cta: string };
/** Oyuncuya sıradaki mantıklı adımı ve darboğazları söyler (önem sırasıyla). */
function advice(g: Game, now: number): Note[] {
  const q = market(g, now),
    notes: Note[] = [];
  const idle = g.staff - g.workers,
    free = seats(g.level) - g.workers;
  if (g.job)
    notes.push({
      tone: "info",
      text:
        "Hatta " +
        g.job +
        " sandalye üretiliyor. " +
        secs(g.ready - now) +
        " sn sonra depoya girer.",
      to: "uretim",
      cta: "Üretimi izle",
    });
  if (g.chairs && q.demand)
    notes.push({
      tone: "ok",
      text:
        "Depoda satışa hazır " +
        g.chairs +
        " sandalye var. Toptancı bugün " +
        q.demand +
        " adet alıyor.",
      to: "piyasa",
      cta: "Satışa git",
    });
  else if (g.chairs)
    notes.push({
      tone: "warn",
      text:
        "Bugünkü talep doldu. Yeni teklif " +
        clock(nextDayIn(g, now)) +
        " sonra gelir.",
      to: "piyasa",
      cta: "Piyasaya bak",
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
  if (!g.job && !g.lots)
    notes.push({
      tone: "bad",
      text: "Ham madde yok; üretim yapılamaz. Depodan parti alın.",
      to: "depo",
      cta: "Ham madde al",
    });
  else if (!g.job && g.workers)
    notes.push({
      tone: "ok",
      text:
        "Hat hazır: " +
        Math.min(maxLots(g), g.lots) * r.batch +
        " sandalyelik çevrim başlatılabilir.",
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
  if (!g.job && free > 0 && g.staff >= 1 && idle === 0 && g.staff < MAX_STAFF)
    notes.push({
      tone: "info",
      text:
        "Hatta " +
        free +
        " boş koltuk var. Yeni çalışan çevrimi hızlandırır ama günlük maaşı artırır.",
      to: "fabrikam",
      cta: "Personel",
    });
  if (g.lots === 1 && !g.job)
    notes.push({
      tone: "info",
      text: "Ham madde azaldı: tek parti kaldı.",
      to: "depo",
      cta: "Depo",
    });
  if (
    g.level < 3 &&
    !g.job &&
    profit(g) - g.investment >= upgradePrice(g) &&
    g.cash >= upgradePrice(g)
  )
    notes.push({
      tone: "info",
      text: "Birikmiş kazancın makine geliştirmeye yetiyor: kapasite ve hat koltuğu artar.",
      to: "fabrikam",
      cta: "Makineye bak",
    });
  return notes;
}

function panel(g: Game, now: number) {
  const running = !!g.job,
    q = market(g, now),
    notes = advice(g, now);
  const top = notes.find((n) => n.tone !== "info") ?? notes[0];
  const left = Math.min(duration(g), Math.max(0, g.ready - now));
  const status = running
    ? badge("Hat çalışıyor", "ok")
    : g.workers && g.lots
      ? badge("Hat hazır", "warn")
      : badge("Hat durdu", "bad");
  const last = state.log[0];
  return (
    '<section class="hero">' +
    '<div class="scene">' +
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
    " koltuk dolu</p>" +
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
      running ? g.job + " adet" : "Bekliyor",
      running
        ? '<span id="hero-left">' + secs(left) + " sn</span> kaldı"
        : g.lots + " parti ham madde",
      running ? "ok" : "warn",
    ) +
    stat(
      "Personel",
      g.workers + " hatta · " + (g.staff - g.workers) + " boşta",
      "Toplam " + g.staff + " · " + money(g.staff * WAGE) + "/gün",
      g.staff - g.workers ? "warn" : "",
    ) +
    stat(
      "Mamul stok",
      g.chairs + " sandalye",
      g.chairs ? "Satışa hazır" : "Depo boş",
      g.chairs ? "ok" : "",
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
        stat("Toptancı", money(q.price), q.demand + " adet talep kaldı") +
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
    ) +
    '<div class="tiles">' +
    (Object.keys(routes) as Page[])
      .filter((k) => k !== "panel")
      .map(
        (k) =>
          '<a href="#' +
          k +
          '">' +
          icon(marks[k]) +
          routes[k] +
          '<span aria-hidden="true">›</span></a>',
      )
      .join("") +
    "</div>"
  );
}

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
    available = profit(g) - g.investment;
  const crewHint = g.job
    ? "Üretim sürerken hat ekibi değişmez."
    : g.workers >= n
      ? "Hattaki " +
        n +
        " koltuk dolu. Daha fazla koltuk için makineyi geliştirin."
      : !idle
        ? "Boşta çalışan yok. Önce çalışan alın."
        : g.workers
          ? "Tek parti " + secs(now1) + " sn → " + secs(plus1) + " sn olur."
          : "Hatta en az 1 çalışan olmadan üretim başlamaz.";
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
          g.level * r.batch + " adet",
          g.level + " parti / çevrim",
        ) +
        stat("Hat koltuğu", String(n), "önerilen ekip: " + n) +
        stat(
          "Tek parti süresi",
          g.workers ? secs(now1) + " sn" : "—",
          g.workers ? g.workers + " çalışanla" : "hatta çalışan yok",
          g.workers ? "" : "bad",
        ) +
        stat(
          "Hat verimliliği",
          "%" + Math.round((100 * g.workers) / n),
          "dolu koltuk oranı",
          g.workers === n ? "ok" : "warn",
        ) +
        "</div>" +
        '<p class="small">Çevrim süresi = 60 sn × parti ÷ (makine seviyesi × hattaki çalışan). Her parti için hatta en az bir çalışan gerekir.</p>',
    ) +
    card(
      "Makine yatırımı",
      g.level < 3
        ? '<table class="compare"><thead><tr><th></th><th>Şimdi</th><th>Seviye ' +
            (g.level + 1) +
            "</th></tr></thead><tbody>" +
            "<tr><td>Çevrim kapasitesi</td><td>" +
            g.level * r.batch +
            "</td><td>" +
            (g.level + 1) * r.batch +
            "</td></tr>" +
            "<tr><td>Hat koltuğu</td><td>" +
            n +
            "</td><td>" +
            seats(g.level + 1) +
            "</td></tr>" +
            "<tr><td>Tek parti · " +
            Math.max(1, g.workers) +
            " çalışan</td><td>" +
            secs(cycle(g.level, 1, g.workers)) +
            " sn</td><td>" +
            secs(cycle(g.level + 1, 1, g.workers)) +
            " sn</td></tr>" +
            "</tbody></table>" +
            "<dl>" +
            line("Yatırım tutarı", money(p)) +
            line(
              "Yatırıma ayrılabilir kazanç",
              money(Math.max(0, available)),
              available >= p ? "good" : "",
            ) +
            "</dl>" +
            button("upgrade", "Makineyi geliştir · " + money(p), {
              disabled: !!g.job || g.cash < p || available < p,
              hint: g.job
                ? "Hat çalışırken geliştirilemez."
                : available < p
                  ? "Faaliyet kârından " +
                    money(p - Math.max(0, available)) +
                    " daha birikmeli."
                  : "Yatırım kasadan çıkar; gider değil, varlık olarak kaydedilir.",
            })
        : "<p>En yüksek makine seviyesindesiniz.</p>",
    )
  );
}

function production(g: Game, now: number) {
  const recipe = card(
    "Ahşap sandalye reçetesi",
    '<div class="grid4">' +
      stat("Parti", r.batch + " sandalye") +
      stat(
        "Ham madde",
        r.boards + " tahta + " + r.kits + " set",
        money(r.materials),
      ) +
      stat("Enerji", money(r.energy), "parti başına") +
      stat("Paketleme", money(r.packaging), "parti başına") +
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
          g.job +
          " sandalye · " +
          g.workers +
          " çalışan</span></div>" +
          '<div class="meter big"><i id="bar" style="width:' +
          (100 * (1 - left / total)).toFixed(1) +
          '%"></i></div>' +
          "<dl>" +
          line("Üretimde", g.job + " sandalye") +
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
      chairs = lots * r.batch,
      time = cycle(g.level, lots, g.workers);
    const material =
      g.lots >= lots
        ? Math.round((g.rawCost * lots) / g.lots)
        : lots * r.materials;
    const variable = lots * (r.energy + r.packaging);
    const labor = Math.round((Math.max(1, g.workers) * WAGE * time) / DAY);
    const cost = material + variable;
    const reason = !g.workers
      ? "Hatta çalışan yok. Fabrikam ekranından atayın."
      : lots > g.workers
        ? "Bu parti için hatta en az " + lots + " çalışan gerekir."
        : lots > g.lots
          ? "Depoda " + lots + " parti ham madde gerekir."
          : g.cash < variable
            ? "Enerji ve paketleme için kasa yetersiz."
            : "";
    return (
      '<article class="plan' +
      (reason ? " off" : "") +
      '"><header><strong>' +
      chairs +
      " sandalye</strong>" +
      badge(g.workers ? secs(time) + " sn" : "—", reason ? "bad" : "ok") +
      "</header><dl>" +
      line("Ham madde", lots + " parti · " + money(material)) +
      line("Enerji + paketleme", money(variable)) +
      line("Üretim maliyeti", money(cost)) +
      line("Birim maliyet", money(Math.round(cost / chairs))) +
      line("İşçilik payı (tahmini)", money(labor)) +
      line("Depoya eklenecek", "+" + chairs + " adet", "good") +
      "</dl>" +
      button("start", chairs + " sandalye üret · " + money(variable), {
        disabled: !!reason,
        qty: lots,
        hint:
          reason ||
          "Kasadan yalnız enerji ve paketleme çıkar; ham madde zaten ödendi.",
      }) +
      "</article>"
    );
  }).join("");
  return (
    card(
      "Üretim emri",
      '<p class="lead">Aktif çalışan: <b>' +
        g.workers +
        "</b> · Depoda <b>" +
        g.lots +
        "</b> parti ham madde · Makine en fazla <b>" +
        g.level +
        "</b> parti alır.</p>" +
        '<div class="plans">' +
        plans +
        "</div>" +
        '<p class="small">İşçilik maaş olarak her gün kesilir; burada bu çevrime düşen payı görürsünüz.</p>',
    ) + recipe
  );
}

function warehouse(g: Game) {
  const need = Math.max(1, maxLots(g));
  const tone: Tone = !g.lots ? "bad" : g.lots < need ? "warn" : "ok";
  return (
    card(
      "Ham madde " +
        badge(
          !g.lots ? "Stok yok" : g.lots < need ? "Kritik" : "Yeterli",
          tone,
        ),
      '<div class="grid2">' +
        stat("Tahta", g.lots * r.boards + " adet", "parti başına " + r.boards) +
        stat(
          "Bağlantı seti",
          g.lots * r.kits + " set",
          "parti başına " + r.kits,
        ) +
        "</div>" +
        '<div class="meter ' +
        tone +
        '"><i style="width:' +
        Math.min(100, (100 * g.lots) / Math.max(need, 4)).toFixed(0) +
        '%"></i></div>' +
        "<dl>" +
        line(
          "Parti sayısı",
          g.lots + " parti · " + g.lots * r.batch + " sandalyelik",
        ) +
        line("Stok maliyeti", money(g.rawCost)) +
        "</dl>" +
        button("buy", "Bir parti al · " + money(r.materials), {
          disabled: g.cash < r.materials,
          hint:
            g.cash < r.materials
              ? "Kasa yetersiz."
              : r.boards +
                " tahta ve " +
                r.kits +
                " bağlantı seti. Para şimdi çıkar; maliyet satışta giderleşir.",
        }),
    ) +
    (g.job
      ? card(
          "Üretimde",
          "<dl>" +
            line("Montaj hattında", g.job + " sandalye") +
            line("Maliyet", money(g.wip)) +
            "</dl>",
        )
      : "") +
    card(
      "Mamul deposu " +
        (g.chairs ? badge("Satışa hazır", "ok") : badge("Boş", "info")),
      "<dl>" +
        line("Ahşap sandalye", g.chairs + " adet") +
        line("Depodaki mamul maliyeti", money(g.goodsCost)) +
        line(
          "Ortalama birim maliyet",
          g.chairs ? money(Math.round(g.goodsCost / g.chairs)) : "—",
        ) +
        "</dl>" +
        (g.chairs ? link("piyasa", "Toptancıya sat") : ""),
    )
  );
}

function trade(g: Game, now: number) {
  const q = market(g, now),
    n = Math.min(g.chairs, q.demand);
  const tomorrow = market(
    { ...g, marketDay: 0 },
    Math.max(now, g.last) + nextDayIn(g, now),
  );
  const quote = (k: number) => {
    const gross = k * q.price,
      tax = Math.round((gross * 5) / 100),
      freight = k * r.shippingPerUnit;
    const basis = g.chairs ? Math.round((g.goodsCost * k) / g.chairs) : 0;
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
  return (
    card(
      "Toptancı teklifi",
      '<div class="grid2">' +
        stat("Fiyat", money(q.price), "adet başına · Gün " + q.day) +
        stat(
          "Kalan talep",
          q.demand + " adet",
          '<span id="quote-time">' +
            clock(nextDayIn(g, now)) +
            "</span> sonra yeni teklif",
          q.demand ? "ok" : "warn",
        ) +
        stat("Satılabilir", n + " adet", "depoda " + g.chairs) +
        stat("Yarın", money(tomorrow.price), tomorrow.demand + " adet talep") +
        "</div>" +
        (n
          ? '<div class="actions">' +
            options
              .map((k) =>
                button(
                  "sell",
                  k + " sandalyeyi sat · +" + money(quote(k).net),
                  { qty: k, kind: k === n ? "" : "ghost" },
                ),
              )
              .join("") +
            "</div>"
          : button(
              "sell",
              g.chairs
                ? "Yeni günün teklifini bekle"
                : "Satılacak sandalye yok",
              {
                disabled: true,
                hint: g.chairs ? "Bugünkü talep doldu." : "Önce üretim yapın.",
              },
            )),
    ) +
    (n
      ? card(
          n + " sandalyenin kâr dökümü",
          "<dl>" +
            line("Satış geliri", money(all.gross)) +
            line("Oyun vergisi (%5)", "−" + money(all.tax), "neg") +
            line(
              "Nakliye (" + money(r.shippingPerUnit) + "/adet)",
              "−" + money(all.freight),
              "neg",
            ) +
            line("Kasaya girecek net tutar", money(all.net), "total") +
            line("Satılan malın maliyeti", "−" + money(all.basis), "neg") +
            line(
              "Satış kârı",
              signed(all.gain),
              all.gain >= 0 ? "total good" : "total bad",
            ) +
            "</dl>" +
            '<p class="small">Ham madde, enerji ve paketleme parası daha önce ödendi. Satışta yalnız maliyeti gider yazılır; kasadan ikinci kez çıkmaz.</p>',
        )
      : "")
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
    stat("Satılan", g.sold + " sandalye") +
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
        line("Ham madde stoku", money(g.rawCost)) +
        line("Üretimdeki iş", money(g.wip)) +
        line("Mamul stoku", money(g.goodsCost)) +
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

function contents(view: Page, g: Game, now: number) {
  switch (view) {
    case "panel":
      return panel(g, now);
    case "fabrikam":
      return factory(g);
    case "uretim":
      return production(g, now);
    case "depo":
      return warehouse(g);
    case "piyasa":
      return trade(g, now);
    case "finans":
      return finance(g);
  }
}

function render() {
  const now = Date.now(),
    g = state.game,
    view = page();
  shownDay = day(g, now);
  dayLabel.innerHTML =
    '<span class="chip">' +
    icon(glyph.clock) +
    "Gün " +
    String(shownDay).padStart(2, "0") +
    "</span>" +
    '<span class="chip cash">' +
    money(g.cash) +
    "</span>";
  nav.innerHTML = (Object.keys(routes) as Page[])
    .map(
      (k) =>
        '<a href="#' +
        k +
        '" ' +
        (view === k ? 'aria-current="page"' : "") +
        ">" +
        icon(marks[k]) +
        routes[k] +
        "</a>",
    )
    .join("");
  screen.innerHTML = "<h1>" + routes[view] + "</h1>" + contents(view, g, now);
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
    location.hash = "panel";
    message.textContent = "Yeni oyun başladı.";
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
};
screen.addEventListener("click", async (event) => {
  const act = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "button[data-act='reset']",
  );
  if (act && !busy && db) return void reset();
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "button[data-cmd]",
  );
  if (!target || target.disabled || busy || !state) return;
  const cmd = target.dataset.cmd as Exclude<Command, "finish" | "payroll">;
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
    message.textContent = done[cmd] ?? names[cmd] + " kaydedildi.";
    message.dataset.tone = "ok";
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
    message.textContent = "";
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
      // Biten üretim ve yeni günün maaşı kayda işlenir.
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
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {
    /* Çevrimiçi oyun IndexedDB'ye kaydetmeye devam eder. */
  });
