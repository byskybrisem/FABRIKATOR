import { catalog } from "./catalog.ts";
export const r = catalog.chair;
export const CAPITAL = 15000000;
export const DAY = 300000;
/** Günlük maaş (kuruş). İşe alımda o günün maaşı peşin ödenir. */
export const WAGE = 45000;
/** Atölyenin barındırabileceği en fazla çalışan. */
export const MAX_STAFF = 6;
/** Uzun süre kapalı kalınca en fazla bu kadar günün maaşı kesilir. */
export const PAYROLL_CATCHUP = 3;
export type Command =
  | "buy"
  | "hire"
  | "fire"
  | "assign"
  | "unassign"
  | "start"
  | "sell"
  | "upgrade"
  | "finish"
  | "payroll";
export type Game = {
  cash: number;
  lots: number;
  rawCost: number;
  chairs: number;
  goodsCost: number;
  /** Bordrodaki toplam çalışan. */
  staff: number;
  /** Montaj hattına atanmış çalışan (staff içinden). */
  workers: number;
  level: number;
  job: number;
  wip: number;
  ready: number;
  born: number;
  last: number;
  marketDay: number;
  taken: number;
  sold: number;
  income: number;
  cogs: number;
  tax: number;
  freight: number;
  investment: number;
  /** Ödenen toplam maaş. */
  wages: number;
  /** Maaşı ödenmiş son oyun günü. */
  paidDay: number;
  rev: number;
};
export function initial(now: number): Game {
  return {
    cash: CAPITAL,
    lots: 0,
    rawCost: 0,
    chairs: 0,
    goodsCost: 0,
    staff: 1,
    workers: 0,
    level: 1,
    job: 0,
    wip: 0,
    ready: 0,
    born: now,
    last: now,
    marketDay: 1,
    taken: 0,
    sold: 0,
    income: 0,
    cogs: 0,
    tax: 0,
    freight: 0,
    investment: 0,
    wages: 0,
    paidDay: 1,
    rev: 0,
  };
}
/** Satıştan kalan: gelir − satılan malın maliyeti − vergi − nakliye. */
export const salesProfit = (g: Game) => g.income - g.cogs - g.tax - g.freight;
/** Faaliyet kârı: satış kârından işçilik düşülür. Makine yatırımı gider değildir. */
export const profit = (g: Game) => salesProfit(g) - g.wages;
export const day = (g: Game, now: number) =>
  1 + Math.floor((Math.max(g.last, now) - g.born) / DAY);
export function market(g: Game, now: number) {
  const d = day(g, now);
  const prices = [100, 105, 96, 110, 99],
    limits = [10, 30, 24, 40, 32];
  const i = (d - 1) % prices.length;
  return {
    day: d,
    price: (r.basePrice * prices[i]) / 100,
    demand: limits[i] - (g.marketDay === d ? g.taken : 0),
  };
}
export const upgradePrice = (g: Game) => g.level * 300000;
/** Hattaki koltuk sayısı: makine seviyesinin bir fazlası. */
export const seats = (level: number) => level + 1;
/**
 * Çevrim süresi: bir çalışan seviye-1 makinede 10 sandalyeyi 60 sn'de monte eder.
 * Makine seviyesi kişi başı hızı artırır, çalışanlar işi paylaşır.
 */
export const cycle = (level: number, lots: number, crew: number) =>
  Math.ceil((r.duration * lots) / (level * Math.max(1, crew)));
/** Mevcut ekiple `lots` partinin süresi (varsayılan: tek parti ya da süren iş). */
export const duration = (g: Game, lots = g.job ? g.job / r.batch : 1) =>
  cycle(g.level, lots, g.workers);
/** Bir çevrimde işlenebilecek en fazla parti: makine ve hattaki çalışan sınırı. */
export const maxLots = (g: Game) => Math.min(g.level, g.workers);
/** Eski kayıtları (çalışan sistemi öncesi) yeni alanlarla tamamlar. */
export function upgradeGame(raw: unknown): Game {
  if (typeof raw !== "object" || raw === null)
    throw new Error("Atölye kaydı okunamadı.");
  const g = { ...(raw as Game) };
  if (g.staff === undefined) {
    // Önceki sürümde atölyede tek bir montaj ustası vardı.
    g.staff = 1;
    g.wages = 0;
    g.paidDay =
      Number.isSafeInteger(g.last) && Number.isSafeInteger(g.born)
        ? day(g, g.last)
        : 1;
  }
  return g;
}
export function validate(g: Game) {
  for (const key of Object.keys(initial(0)) as (keyof Game)[]) {
    if (!Number.isSafeInteger(g[key]) || g[key] < 0)
      throw new Error("Atölye kaydı tutarsız.");
  }
  if (
    g.level < 1 ||
    g.level > 3 ||
    g.staff > MAX_STAFF ||
    g.workers > g.staff ||
    g.workers > seats(g.level) ||
    g.paidDay < 1 ||
    g.paidDay > day(g, g.last) ||
    g.last < g.born ||
    g.job > r.batch * g.level ||
    g.job % r.batch !== 0 ||
    !!g.job !== !!g.ready ||
    !!g.job !== !!g.wip ||
    !!g.lots !== !!g.rawCost ||
    !!g.chairs !== !!g.goodsCost ||
    g.cash + g.rawCost + g.wip + g.goodsCost + g.investment !==
      CAPITAL + profit(g)
  )
    throw new Error("Atölye kaydındaki bakiye veya stok doğrulanamadı.");
}
/**
 * Yeni oyun günlerinin maaşını keser (kapalı geçen süre için en fazla PAYROLL_CATCHUP gün).
 * Kasa yetmezse maaşı ödenemeyen çalışanlar ayrılır; kasa hiçbir zaman eksiye düşmez.
 */
function payroll(g: Game, today: number) {
  if (g.paidDay >= today) return;
  const days = Math.min(today - g.paidDay, PAYROLL_CATCHUP);
  for (let i = 0; i < days; i++) {
    while (g.staff > 0 && g.cash < g.staff * WAGE) {
      g.staff--;
      g.workers = Math.min(g.workers, g.staff);
    }
    g.cash -= g.staff * WAGE;
    g.wages += g.staff * WAGE;
  }
  g.paidDay = today;
}
/**
 * Bekleyen otomatik işlem. Yeni günün maaşı önce gelir: aksi halde maaş, aynı
 * adımda biten üretimin hareketine karışır ve defterde ayrı görünmez.
 */
export function due(g: Game, now: number): Command | undefined {
  if (g.paidDay < day(g, now)) return "payroll";
  if (g.job && now >= g.ready) return "finish";
  return undefined;
}
function need(ok: boolean, message: string) {
  if (!ok) throw new Error(message);
}
export function advance(
  previous: Game,
  cmd: Command,
  now: number,
  qty = 1,
): Game {
  const g = {
    ...previous,
    last: Math.max(now, previous.last),
    rev: previous.rev + 1,
  };
  const q = market(g, g.last);
  if (g.marketDay !== q.day) {
    g.marketDay = q.day;
    g.taken = 0;
  }
  payroll(g, q.day);
  switch (cmd) {
    case "buy":
      need(g.cash >= r.materials, "Ham madde için bakiye yetersiz.");
      g.cash -= r.materials;
      g.rawCost += r.materials;
      g.lots++;
      break;
    case "hire":
      need(g.staff < MAX_STAFF, "Atölyede yeni çalışana yer yok.");
      need(g.cash >= WAGE, "İlk günün maaşı için bakiye yetersiz.");
      g.cash -= WAGE;
      g.wages += WAGE;
      g.staff++;
      break;
    case "fire":
      need(
        g.staff > g.workers,
        "Önce bir çalışanı hattan çekin; yalnız boştaki çalışan ayrılabilir.",
      );
      g.staff--;
      break;
    case "assign":
      need(!g.job, "Üretim sürerken hat ekibi değişmez.");
      need(g.workers < g.staff, "Boşta çalışan yok. Önce çalışan alın.");
      need(g.workers < seats(g.level), "Hattaki tüm koltuklar dolu.");
      g.workers++;
      break;
    case "unassign":
      need(!g.job, "Üretim sürerken hat ekibi değişmez.");
      need(g.workers > 0, "Hatta çalışan yok.");
      g.workers--;
      break;
    case "payroll":
      break;
    case "start": {
      need(
        !g.job && g.workers > 0,
        "Hat boş olmalı ve en az bir çalışan atanmalı.",
      );
      need(
        Number.isInteger(qty) && qty >= 1 && qty <= maxLots(g) && qty <= g.lots,
        "Stok, makine kapasitesi veya hattaki çalışan yetersiz.",
      );
      const expense = qty * (r.energy + r.packaging);
      need(g.cash >= expense, "Enerji ve paketleme için bakiye yetersiz.");
      const used = Math.round((g.rawCost * qty) / g.lots);
      g.rawCost -= used;
      g.lots -= qty;
      g.cash -= expense;
      g.wip = used + expense;
      g.job = qty * r.batch;
      g.ready = g.last + cycle(g.level, qty, g.workers);
      break;
    }
    case "finish":
      need(g.job > 0 && g.last >= g.ready, "Üretim devam ediyor.");
      g.chairs += g.job;
      g.goodsCost += g.wip;
      g.wip = 0;
      g.job = 0;
      g.ready = 0;
      break;
    case "sell": {
      need(
        Number.isInteger(qty) && qty > 0 && qty <= g.chairs && qty <= q.demand,
        "Satış için stok veya günlük talep yetersiz.",
      );
      const gross = qty * q.price,
        tax = Math.round((gross * 5) / 100),
        freight = qty * r.shippingPerUnit;
      const basis = Math.round((g.goodsCost * qty) / g.chairs);
      g.cash += gross - tax - freight;
      g.income += gross;
      g.tax += tax;
      g.freight += freight;
      g.goodsCost -= basis;
      g.cogs += basis;
      g.chairs -= qty;
      g.sold += qty;
      g.taken += qty;
      break;
    }
    case "upgrade": {
      const price = upgradePrice(g);
      need(
        !g.job &&
          g.level < 3 &&
          g.cash >= price &&
          profit(g) - g.investment >= price,
        "Geliştirme için boş hat ve yeterli birikmiş kazanç gerekli.",
      );
      g.cash -= price;
      g.investment += price;
      g.level++;
      break;
    }
    default:
      throw new Error("Geçersiz işlem.");
  }
  validate(g);
  return g;
}
