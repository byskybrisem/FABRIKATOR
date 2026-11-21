import { catalog } from "./catalog.ts";
export const r = catalog.chair;
export const CAPITAL = 15000000;
export const DAY = 300000;
export type Command =
  "buy" | "assign" | "start" | "sell" | "upgrade" | "finish";
export type Game = {
  cash: number;
  lots: number;
  rawCost: number;
  chairs: number;
  goodsCost: number;
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
  rev: number;
};
export function initial(now: number): Game {
  return {
    cash: CAPITAL,
    lots: 0,
    rawCost: 0,
    chairs: 0,
    goodsCost: 0,
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
    rev: 0,
  };
}
export const profit = (g: Game) => g.income - g.cogs - g.tax - g.freight;
export const day = (g: Game, now: number) =>
  1 + Math.floor((Math.max(g.last, now) - g.born) / DAY);
export function market(g: Game, now: number) {
  const d = day(g, now);
  const prices = [100, 105, 96, 110, 99],
    limits = [10, 18, 12, 20, 16];
  const i = (d - 1) % prices.length;
  return {
    day: d,
    price: (r.basePrice * prices[i]) / 100,
    demand: limits[i] - (g.marketDay === d ? g.taken : 0),
  };
}
export const upgradePrice = (g: Game) => g.level * 300000;
export const duration = (g: Game) => Math.ceil(r.duration / g.level);
export function validate(g: Game) {
  for (const key of Object.keys(initial(0)) as (keyof Game)[]) {
    if (!Number.isSafeInteger(g[key]) || g[key] < 0)
      throw new Error("Atölye kaydı tutarsız.");
  }
  if (
    g.level < 1 ||
    g.level > 3 ||
    g.workers > 1 ||
    g.last < g.born ||
    g.job > r.batch * g.level ||
    !!g.job !== !!g.ready ||
    !!g.job !== !!g.wip ||
    !!g.lots !== !!g.rawCost ||
    !!g.chairs !== !!g.goodsCost ||
    g.cash + g.rawCost + g.wip + g.goodsCost + g.investment !==
      CAPITAL + profit(g)
  )
    throw new Error("Atölye kaydındaki bakiye veya stok doğrulanamadı.");
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
  switch (cmd) {
    case "buy":
      need(g.cash >= r.materials, "Ham madde için bakiye yetersiz.");
      g.cash -= r.materials;
      g.rawCost += r.materials;
      g.lots++;
      break;
    case "assign":
      need(!g.job, "Üretim bitince usta görevini değiştirebilirsiniz.");
      g.workers = 1 - g.workers;
      break;
    case "start": {
      need(!g.job && g.workers === 1, "Hat boş olmalı ve bir usta atanmalı.");
      need(
        Number.isInteger(qty) && qty >= 1 && qty <= g.level && qty <= g.lots,
        "Stok veya makine kapasitesi yetersiz.",
      );
      const expense = qty * (r.energy + r.packaging);
      need(g.cash >= expense, "Enerji ve paketleme için bakiye yetersiz.");
      const used = Math.round((g.rawCost * qty) / g.lots);
      g.rawCost -= used;
      g.lots -= qty;
      g.cash -= expense;
      g.wip = used + expense;
      g.job = qty * r.batch;
      g.ready = g.last + duration(g);
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
