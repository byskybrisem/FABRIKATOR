import {
  catalog,
  customers,
  materials,
  products,
  type MaterialId,
  type ProductId,
  type Recipe,
} from "./catalog.ts";
export type { ProductId, MaterialId, Recipe } from "./catalog.ts";
export { catalog, customers, materials, products } from "./catalog.ts";

export const r = catalog.chair;
export const CAPITAL = 15000000;
export const DAY = 300000;
/** Günlük maaş (kuruş). İşe alımda o günün maaşı peşin ödenir. */
export const WAGE = 45000;
/** Atölyenin barındırabileceği en fazla çalışan. */
export const MAX_STAFF = 6;
/** Uzun süre kapalı kalınca en fazla bu kadar günün maaşı kesilir. */
export const PAYROLL_CATCHUP = 3;
/** Aynı anda yürütülebilecek en fazla müşteri siparişi. */
export const MAX_ORDERS = 4;
/** Teslim edilmeyen siparişte sözleşme bedelinin bu yüzdesi ceza olarak ödenir. */
export const PENALTY_PERCENT = 10;
/** Karşı teklif fiyatı yüzde kaç artırır. */
export const COUNTER_PERCENT = 10;
export const START_REP = 10;
/** Fazla malzeme kayıtlı maliyetinin bu yüzdesine elden çıkarılır. */
export const SALVAGE_PERCENT = 60;

export type Command =
  | "buy"
  | "hire"
  | "fire"
  | "assign"
  | "unassign"
  | "start"
  | "sell"
  | "upgrade"
  | "salvage"
  | "accept"
  | "decline"
  | "counter"
  | "reserve"
  | "deliver"
  | "finish"
  | "payroll"
  | "expire";
/** İşlem bağımsız değişkeni: miktar (parti veya adet), ürün ve teklif/sipariş kimliği. */
export type Arg = { qty?: number; product?: ProductId; id?: string };

export type Stock = { qty: number; cost: number };
export type Goods = Stock & { reserved: number };
export type Offer = {
  id: string;
  customer: number;
  product: ProductId;
  qty: number;
  /** Sözleşme bedeli (kuruş, vergi öncesi). */
  price: number;
  /** Müşteriye teslim nakliyesi (kuruş). */
  shipping: number;
  rep: number;
  /** Bu oyun gününün sonuna kadar teslim edilmeli. */
  dueDay: number;
  /** Müşterinin karşı teklifte kabul edeceği en yüksek bedel. */
  ceiling: number;
};
export type Order = Omit<Offer, "ceiling"> & { reserved: number };

export type Game = {
  cash: number;
  /** Bordrodaki toplam çalışan. */
  staff: number;
  /** Montaj hattına atanmış çalışan (staff içinden). */
  workers: number;
  level: number;
  materials: Record<MaterialId, Stock>;
  goods: Record<ProductId, Goods>;
  /** Hatta üretilen adet ve ürün. */
  job: number;
  jobProduct: ProductId | "";
  wip: number;
  ready: number;
  born: number;
  last: number;
  marketDay: number;
  /** Toptancının bugün aldığı adet (ürün bazında). */
  taken: Record<ProductId, number>;
  sold: number;
  income: number;
  cogs: number;
  tax: number;
  freight: number;
  investment: number;
  /** Ödenen toplam maaş. */
  wages: number;
  /** Teslim edilmeyen siparişlerin ödenen cezaları. */
  penalties: number;
  /** Elden çıkarılan malzemenin kayıtlı maliyetiyle satış bedeli arasındaki zarar. */
  writeoffs: number;
  /** Maaşı ödenmiş son oyun günü. */
  paidDay: number;
  /** Müşteri itibarı (0–100). */
  rep: number;
  /** Teklif listesinin üretildiği oyun günü. */
  offerDay: number;
  offers: Offer[];
  orders: Order[];
  delivered: number;
  rev: number;
};

const record = <K extends string, V>(keys: readonly K[], value: () => V) =>
  Object.fromEntries(keys.map((k) => [k, value()])) as Record<K, V>;
const materialIds = Object.keys(materials) as MaterialId[];

export function initial(now: number): Game {
  const g: Game = {
    cash: CAPITAL,
    staff: 1,
    workers: 0,
    level: 1,
    materials: record(materialIds, () => ({ qty: 0, cost: 0 })),
    goods: record(products, () => ({ qty: 0, cost: 0, reserved: 0 })),
    job: 0,
    jobProduct: "",
    wip: 0,
    ready: 0,
    born: now,
    last: now,
    marketDay: 1,
    taken: record(products, () => 0),
    sold: 0,
    income: 0,
    cogs: 0,
    tax: 0,
    freight: 0,
    investment: 0,
    wages: 0,
    penalties: 0,
    writeoffs: 0,
    paidDay: 1,
    rep: START_REP,
    offerDay: 1,
    offers: [],
    orders: [],
    delivered: 0,
    rev: 0,
  };
  g.offers = generateOffers(g, 1);
  return g;
}

/** Satıştan kalan: gelir − satılan malın maliyeti − vergi − nakliye. */
export const salesProfit = (g: Game) => g.income - g.cogs - g.tax - g.freight;
/**
 * Faaliyet kârı: işçilik, sözleşme cezaları ve stok değer kaybı düşülür.
 * Makine yatırımı gider değildir.
 */
export const profit = (g: Game) =>
  salesProfit(g) - g.wages - g.penalties - g.writeoffs;
export const day = (g: Game, now: number) =>
  1 + Math.floor((Math.max(g.last, now) - g.born) / DAY);

export function market(g: Game, now: number, product: ProductId = "chair") {
  const d = day(g, now),
    p = catalog[product];
  const prices = [100, 105, 96, 110, 99];
  const i = (d - 1) % prices.length;
  return {
    day: d,
    price: (p.basePrice * prices[i]) / 100,
    demand: p.limits[i] - (g.marketDay === d ? g.taken[product] : 0),
  };
}
export const upgradePrice = (g: Game) => g.level * 300000;
/** Hattaki koltuk sayısı: makine seviyesinin bir fazlası. */
export const seats = (level: number) => level + 1;
/**
 * Çevrim süresi: bir çalışan seviye-1 makinede bir partiyi ürünün süresinde monte eder.
 * Makine seviyesi kişi başı hızı artırır, çalışanlar işi paylaşır.
 */
export const cycle = (
  level: number,
  lots: number,
  crew: number,
  product: ProductId = "chair",
) =>
  Math.ceil((catalog[product].duration * lots) / (level * Math.max(1, crew)));
/** Mevcut ekiple `lots` partinin süresi (varsayılan: süren iş ya da tek parti). */
export const duration = (
  g: Game,
  lots?: number,
  product: ProductId = g.jobProduct || "chair",
) =>
  cycle(
    g.level,
    lots ?? (g.job ? g.job / catalog[product].batch : 1),
    g.workers,
    product,
  );
/** Bir çevrimde işlenebilecek en fazla parti: makine ve hattaki çalışan sınırı. */
export const maxLots = (g: Game) => Math.min(g.level, g.workers);
/** Depodaki malzemeyle kaç parti üretilebilir. */
export const lotsOf = (g: Game, product: ProductId = "chair") =>
  Math.min(
    Math.floor(g.materials.board.qty / catalog[product].boards),
    Math.floor(g.materials.kit.qty / catalog[product].kits),
  );
/** Siparişe ayrılmamış, satılabilir mamul. */
export const available = (g: Game, product: ProductId) =>
  g.goods[product].qty - g.goods[product].reserved;
export const stockValue = (g: Game) =>
  materialIds.reduce((s, m) => s + g.materials[m].cost, 0) +
  products.reduce((s, p) => s + g.goods[p].cost, 0);
export function lockReason(g: Game, product: ProductId) {
  const u = catalog[product].unlock;
  if (u?.rep && g.rep < u.rep) return "İtibar " + u.rep + " olunca açılır";
  if (u?.level && g.level < u.level)
    return "Makine seviyesi " + u.level + " olunca açılır";
  return "";
}
export const unlocked = (g: Game, product: ProductId) =>
  !lockReason(g, product);
/** Liste fiyatlarıyla birim üretim maliyeti (malzeme + enerji + paketleme). */
export const unitCost = (p: Recipe) =>
  Math.round((p.materials + p.energy + p.packaging) / p.batch);
/** Bir teklifin vergi, nakliye ve üretim maliyeti sonrası tahmini net kazancı. */
export function offerGain(
  g: Game,
  o: Pick<Offer, "product" | "qty" | "price" | "shipping">,
) {
  const stock = g.goods[o.product];
  const unit = stock.qty
    ? stock.cost / stock.qty
    : unitCost(catalog[o.product]);
  const tax = Math.round((o.price * 5) / 100);
  return o.price - tax - o.shipping - Math.round(unit * o.qty);
}
export const counterPrice = (o: Pick<Offer, "price">) =>
  Math.round((o.price * (100 + COUNTER_PERCENT)) / 100 / 100) * 100;

// Tohumlu, tekrar üretilebilir rastgelelik (mulberry32).
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const roundTL = (k: number, step = 10000) =>
  Math.max(step, Math.round(k / step) * step);
/**
 * O günün müşteri teklifleri: oyunun doğum zamanı ve günle tohumlanır; aynı gün aynı
 * teklifleri üretir. İtibar teklif sayısını ve fiyat düzeyini artırır.
 */
export function generateOffers(g: Game, d: number): Offer[] {
  const rand = rng((g.born % 2147483647) ^ Math.imul(d, 2654435761));
  const open = products.filter((p) => unlocked(g, p));
  const count = 2 + (g.rep >= 40 ? 1 : 0) + (g.rep >= 75 ? 1 : 0);
  const out: Offer[] = [];
  for (let i = 0; i < count; i++) {
    const c = Math.floor(rand() * customers.length),
      who = customers[c];
    const product = open[Math.floor(rand() * open.length)],
      p = catalog[product];
    const lots = 1 + Math.floor(rand() * (1 + g.level + who.size));
    const qty = p.batch * lots;
    // Bazı teklifler zararlı, bazıları çok kârlı: 0,50 – 1,20 bandı + itibar ve müşteri eğilimi.
    const factor = 0.5 + rand() * 0.7 + who.bias + g.rep / 2000;
    const price = roundTL(qty * p.basePrice * factor);
    const shipping = roundTL(
      qty * p.shippingPerUnit * (0.8 + rand() * 0.8),
      1000,
    );
    const days = 1 + Math.floor(rand() * 3);
    const rep = 1 + (lots >= 3 || rand() < 0.3 ? 1 : 0);
    const ceiling = Math.round(price * (1.02 + rand() * 0.16));
    out.push({
      id: d + "-" + i,
      customer: c,
      product,
      qty,
      price,
      shipping,
      rep,
      dueDay: d + days,
      ceiling,
    });
  }
  return out;
}

/** Eski kayıtları (çalışan ve çok ürün sistemi öncesi) güncel biçime taşır. */
export function upgradeGame(raw: unknown): Game {
  if (typeof raw !== "object" || raw === null)
    throw new Error("Atölye kaydı okunamadı.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = { ...(raw as Record<string, any>) };
  const dayOf = () =>
    Number.isSafeInteger(g.last) && Number.isSafeInteger(g.born)
      ? day(g as Game, g.last)
      : 1;
  if (g.staff === undefined) {
    // Çalışan sistemi öncesi: atölyede tek bir montaj ustası vardı.
    g.staff = 1;
    g.wages = 0;
    g.paidDay = dayOf();
  }
  if (g.materials === undefined) {
    // Tek ürün dönemi: "parti" sandalye malzemesiydi (20 tahta + 10 bağlantı seti).
    // Malzeme maliyeti kuruşu kuruşuna korunur, liste fiyatı oranında paylaştırılır.
    const lots = g.lots,
      rawCost = g.rawCost;
    const boardCost = Math.round((rawCost * 3) / 4);
    g.materials = {
      board: { qty: lots * r.boards, cost: boardCost },
      kit: { qty: lots * r.kits, cost: rawCost - boardCost },
    };
    g.goods = record(products, () => ({ qty: 0, cost: 0, reserved: 0 }));
    g.goods.chair = { qty: g.chairs, cost: g.goodsCost, reserved: 0 };
    g.jobProduct = g.job ? "chair" : "";
    g.taken = { ...record(products, () => 0), chair: g.taken };
    g.penalties = 0;
    g.writeoffs = 0;
    g.rep = START_REP;
    g.delivered = 0;
    g.orders = [];
    for (const k of ["lots", "rawCost", "chairs", "goodsCost"]) delete g[k];
    // Yalnız bugünün teklifleri üretilir; geçmiş günler için teklif birikmez.
    g.offerDay = dayOf();
    g.offers = Number.isSafeInteger(g.born)
      ? generateOffers(g as Game, g.offerDay)
      : [];
  }
  return g as Game;
}

const int = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
const scalars: (keyof Game)[] = [
  "cash",
  "staff",
  "workers",
  "level",
  "job",
  "wip",
  "ready",
  "born",
  "last",
  "marketDay",
  "sold",
  "income",
  "cogs",
  "tax",
  "freight",
  "investment",
  "wages",
  "penalties",
  "writeoffs",
  "paidDay",
  "rep",
  "offerDay",
  "delivered",
  "rev",
];
export function validate(g: Game) {
  const bad = (why = "Atölye kaydı tutarsız."): never => {
    throw new Error(why);
  };
  if (typeof g !== "object" || g === null) bad();
  for (const key of scalars) if (!int(g[key])) bad();
  if (
    typeof g.materials !== "object" ||
    typeof g.goods !== "object" ||
    typeof g.taken !== "object" ||
    !g.materials ||
    !g.goods ||
    !g.taken
  )
    bad();
  for (const m of materialIds) {
    const s = g.materials[m];
    if (!s || !int(s.qty) || !int(s.cost) || !!s.qty !== !!s.cost) bad();
  }
  const reserved = record(products, () => 0);
  if (
    !Array.isArray(g.orders) ||
    !Array.isArray(g.offers) ||
    g.orders.length > MAX_ORDERS
  )
    bad();
  for (const o of g.orders) {
    if (!o || !catalog[o.product] || typeof o.id !== "string") bad();
    for (const k of [
      "qty",
      "price",
      "shipping",
      "rep",
      "dueDay",
      "reserved",
      "customer",
    ] as const)
      if (!int(o[k])) bad();
    if (o.reserved > o.qty || !customers[o.customer]) bad();
    reserved[o.product] += o.reserved;
  }
  if (new Set(g.orders.map((o) => o.id)).size !== g.orders.length) bad();
  for (const o of g.offers)
    if (
      !o ||
      !catalog[o.product] ||
      !int(o.qty) ||
      !int(o.price) ||
      !int(o.ceiling) ||
      !customers[o.customer]
    )
      bad();
  for (const p of products) {
    const s = g.goods[p];
    if (
      !s ||
      !int(s.qty) ||
      !int(s.cost) ||
      !int(s.reserved) ||
      !int(g.taken[p])
    )
      bad();
    if (
      !!s.qty !== !!s.cost ||
      s.reserved > s.qty ||
      s.reserved !== reserved[p]
    )
      bad();
  }
  const job = g.jobProduct ? catalog[g.jobProduct] : undefined;
  if (
    g.level < 1 ||
    g.level > 3 ||
    g.staff > MAX_STAFF ||
    g.workers > g.staff ||
    g.workers > seats(g.level) ||
    g.paidDay < 1 ||
    g.paidDay > day(g, g.last) ||
    g.offerDay > day(g, g.last) ||
    g.rep > 100 ||
    g.last < g.born ||
    (g.jobProduct !== "" && !job) ||
    !!g.job !== !!job ||
    (job && (g.job > job.batch * g.level || g.job % job.batch !== 0)) ||
    !!g.job !== !!g.ready ||
    !!g.job !== !!g.wip ||
    g.cash + stockValue(g) + g.wip + g.investment !== CAPITAL + profit(g)
  )
    bad("Atölye kaydındaki bakiye veya stok doğrulanamadı.");
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
/** Teslim tarihi geçen siparişler iptal olur: ceza, itibar kaybı ve ayrılan stoğun serbest kalması. */
function expire(g: Game, today: number) {
  const keep: Order[] = [];
  for (const o of g.orders) {
    if (o.dueDay >= today) {
      keep.push(o);
      continue;
    }
    // Ceza kasayı eksiye düşürmez.
    const fine = Math.min(
      g.cash,
      Math.round((o.price * PENALTY_PERCENT) / 100),
    );
    g.cash -= fine;
    g.penalties += fine;
    g.rep = Math.max(0, g.rep - 2 * o.rep);
    g.goods[o.product].reserved -= o.reserved;
  }
  g.orders = keep;
}
const overdue = (g: Game, today: number) =>
  g.orders.some((o) => o.dueDay < today);
/**
 * Bekleyen otomatik işlem. Sıra önemlidir: yeni günün maaşı, ardından süresi geçen
 * siparişler, en son biten üretim; her biri kendi hareket satırına yazılır.
 */
export function due(g: Game, now: number): Command | undefined {
  const today = day(g, now);
  if (g.paidDay < today) return "payroll";
  if (overdue(g, today)) return "expire";
  if (g.job && now >= g.ready) return "finish";
  return undefined;
}
function need(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const findOffer = (g: Game, id?: string) => {
  const o = g.offers.find((x) => x.id === id);
  need(o, "Bu teklif artık geçerli değil.");
  return o;
};
const findOrder = (g: Game, id?: string) => {
  const o = g.orders.find((x) => x.id === id);
  need(o, "Sipariş bulunamadı.");
  return o;
};
function open(g: Game, o: Offer, price: number) {
  need(
    g.orders.length < MAX_ORDERS,
    "Aynı anda en fazla " + MAX_ORDERS + " sipariş yürütülebilir.",
  );
  const { ceiling: _ceiling, ...rest } = o;
  g.orders = [...g.orders, { ...rest, price, reserved: 0 }];
}

export function advance(
  previous: Game,
  cmd: Command,
  now: number,
  arg: number | Arg = {},
): Game {
  const {
    qty = 1,
    product = "chair",
    id,
  } = typeof arg === "number" ? { qty: arg } : arg;
  need(catalog[product], "Geçersiz ürün.");
  const p = catalog[product];
  const g: Game = {
    ...previous,
    materials: { ...previous.materials },
    goods: { ...previous.goods },
    taken: { ...previous.taken },
    last: Math.max(now, previous.last),
    rev: previous.rev + 1,
  };
  for (const m of materialIds) g.materials[m] = { ...g.materials[m] };
  for (const k of products) g.goods[k] = { ...g.goods[k] };
  const today = day(g, g.last);
  if (g.marketDay !== today) {
    g.marketDay = today;
    g.taken = record(products, () => 0);
  }
  payroll(g, today);
  if (cmd === "expire") expire(g, today);
  if (g.offerDay !== today) {
    g.offerDay = today;
    g.offers = generateOffers(g, today);
  }
  const q = market(g, g.last, product);
  switch (cmd) {
    case "buy": {
      need(Number.isInteger(qty) && qty >= 1 && qty <= 10, "Geçersiz miktar.");
      const cost = qty * p.materials;
      need(g.cash >= cost, "Ham madde için bakiye yetersiz.");
      g.cash -= cost;
      g.materials.board.qty += qty * p.boards;
      g.materials.board.cost += qty * p.boards * materials.board.price;
      g.materials.kit.qty += qty * p.kits;
      g.materials.kit.cost += qty * p.kits * materials.kit.price;
      break;
    }
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
    case "expire":
      break;
    case "start": {
      need(
        !g.job && g.workers > 0,
        "Hat boş olmalı ve en az bir çalışan atanmalı.",
      );
      need(unlocked(g, product), lockReason(g, product) || "Ürün kilitli.");
      need(
        Number.isInteger(qty) &&
          qty >= 1 &&
          qty <= maxLots(g) &&
          qty <= lotsOf(g, product),
        "Stok, makine kapasitesi veya hattaki çalışan yetersiz.",
      );
      const expense = qty * (p.energy + p.packaging);
      need(g.cash >= expense, "Enerji ve paketleme için bakiye yetersiz.");
      let used = 0;
      for (const [m, n] of [
        ["board", p.boards],
        ["kit", p.kits],
      ] as const) {
        const s = g.materials[m],
          take = n * qty;
        const cost = Math.round((s.cost * take) / s.qty);
        s.cost -= cost;
        s.qty -= take;
        used += cost;
      }
      g.cash -= expense;
      g.wip = used + expense;
      g.job = qty * p.batch;
      g.jobProduct = product;
      g.ready = g.last + cycle(g.level, qty, g.workers, product);
      break;
    }
    case "finish": {
      need(
        g.job > 0 && g.jobProduct && g.last >= g.ready,
        "Üretim devam ediyor.",
      );
      const s = g.goods[g.jobProduct];
      s.qty += g.job;
      s.cost += g.wip;
      g.wip = 0;
      g.job = 0;
      g.jobProduct = "";
      g.ready = 0;
      break;
    }
    case "sell": {
      need(
        Number.isInteger(qty) &&
          qty > 0 &&
          qty <= available(g, product) &&
          qty <= q.demand,
        "Satış için stok veya günlük talep yetersiz.",
      );
      const s = g.goods[product];
      const gross = qty * q.price,
        tax = Math.round((gross * 5) / 100),
        freight = qty * p.shippingPerUnit;
      const basis = Math.round((s.cost * qty) / s.qty);
      g.cash += gross - tax - freight;
      g.income += gross;
      g.tax += tax;
      g.freight += freight;
      s.cost -= basis;
      s.qty -= qty;
      g.cogs += basis;
      g.sold += qty;
      g.taken[product] += qty;
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
    case "salvage": {
      // Kurtarma yolu: kasası tükenen oyuncu malzemesini nakde çevirip yeniden üretebilir.
      need(
        lotsOf(g, product) >= qty && qty >= 1 && Number.isInteger(qty),
        "Elden çıkarılacak malzeme yok.",
      );
      let basis = 0;
      for (const [m, n] of [
        ["board", p.boards],
        ["kit", p.kits],
      ] as const) {
        const s = g.materials[m],
          take = n * qty;
        const cost = Math.round((s.cost * take) / s.qty);
        s.cost -= cost;
        s.qty -= take;
        basis += cost;
      }
      const proceeds = Math.round((basis * SALVAGE_PERCENT) / 100);
      g.cash += proceeds;
      g.writeoffs += basis - proceeds;
      break;
    }
    case "accept": {
      const o = findOffer(g, id);
      open(g, o, o.price);
      g.offers = g.offers.filter((x) => x !== o);
      break;
    }
    case "decline": {
      const o = findOffer(g, id);
      g.offers = g.offers.filter((x) => x !== o);
      break;
    }
    case "counter": {
      // Tek hak: müşteri ya yükseltilmiş bedeli kabul eder ya da tekliften çekilir.
      const o = findOffer(g, id),
        asked = counterPrice(o);
      if (o.ceiling >= asked) open(g, o, asked);
      g.offers = g.offers.filter((x) => x !== o);
      break;
    }
    case "reserve": {
      const o = findOrder(g, id);
      const add = Math.min(o.qty - o.reserved, available(g, o.product));
      need(
        add > 0,
        o.reserved === o.qty
          ? "Sipariş için stok zaten ayrıldı."
          : "Ayrılacak hazır stok yok.",
      );
      g.orders = g.orders.map((x) =>
        x === o ? { ...x, reserved: x.reserved + add } : x,
      );
      g.goods[o.product].reserved += add;
      break;
    }
    case "deliver": {
      const o = findOrder(g, id);
      const add = Math.min(o.qty - o.reserved, available(g, o.product));
      need(
        o.reserved + add === o.qty,
        "Teslim için " + (o.qty - o.reserved - add) + " adet daha gerekli.",
      );
      const s = g.goods[o.product];
      s.reserved += add;
      const tax = Math.round((o.price * 5) / 100);
      const basis = Math.round((s.cost * o.qty) / s.qty);
      need(
        g.cash + o.price - tax - o.shipping >= 0,
        "Nakliye için bakiye yetersiz.",
      );
      g.cash += o.price - tax - o.shipping;
      g.income += o.price;
      g.tax += tax;
      g.freight += o.shipping;
      s.cost -= basis;
      s.qty -= o.qty;
      s.reserved -= o.qty;
      g.cogs += basis;
      g.sold += o.qty;
      g.rep = Math.min(100, g.rep + o.rep);
      g.delivered++;
      g.orders = g.orders.filter((x) => x.id !== o.id);
      break;
    }
    default:
      throw new Error("Geçersiz işlem.");
  }
  validate(g);
  return g;
}
