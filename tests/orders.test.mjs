import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { openWorkshop, apply, resume, read } from "../src/store.ts";
import {
  advance,
  available,
  catalog,
  counterPrice,
  cycle,
  day,
  due,
  generateOffers,
  initial,
  lockReason,
  lotsOf,
  products,
  profit,
  upgradeGame,
  validate,
  CAPITAL,
  DAY,
  MAX_ORDERS,
  START_REP,
} from "../src/workshop.ts";

function db(t) {
  const sql = new DatabaseSync(":memory:");
  t.after(() => sql.isOpen && sql.close());
  return {
    sql,
    execSync: (q) => sql.exec(q),
    getFirstSync: (q) => sql.prepare(q).get(),
    runSync: (q, ...args) => sql.prepare(q).run(...args),
  };
}
const run = (g, cmd, now, arg) => advance(g, cmd, now, arg);
/** Sandalye üretir: malzeme alır, ustayı atar, `lots` parti üretip bitirir. */
function chairs(g, lots = 1, now = g.last) {
  for (let i = 0; i < lots; i++) g = run(g, "buy", now, { product: "chair" });
  if (!g.workers) g = run(g, "assign", now);
  while (g.workers < lots) {
    g = run(g, "hire", now);
    g = run(g, "assign", now);
  }
  g = run(g, "start", now, { product: "chair", qty: lots });
  return run(g, "finish", g.ready);
}
const withOffer = (g, offer) => ({ ...g, offers: [offer] });
const offer = (over = {}) => ({
  id: "1-9",
  customer: 0,
  product: "chair",
  qty: 10,
  price: 950000,
  shipping: 40000,
  rep: 3,
  dueDay: 2,
  ceiling: 1100000,
  ...over,
});

test("masa itibarla, raf makine seviyesiyle açılır; her ürünün süresi ve stoğu ayrıdır", () => {
  let g = initial(0);
  assert.equal(lockReason(g, "chair"), "");
  assert.match(lockReason(g, "table"), /İtibar 15/);
  assert.match(lockReason(g, "shelf"), /seviyesi 2/);
  g = run(g, "buy", 0, { product: "table" });
  assert.deepEqual([g.materials.board.qty, g.materials.kit.qty], [30, 10]);
  assert.equal(g.cash, CAPITAL - catalog.table.materials);
  g = run(g, "assign", 0);
  assert.throws(() => run(g, "start", 0, { product: "table" }), /İtibar/);
  g = { ...g, rep: 15 };
  g = run(g, "start", 0, { product: "table" });
  assert.equal(g.ready - g.last, 120000);
  assert.equal(g.jobProduct, "table");
  g = run(g, "finish", g.ready);
  assert.deepEqual(g.goods.table, { qty: 5, cost: 640000, reserved: 0 });
  assert.equal(g.goods.chair.qty, 0);
  assert.equal(cycle(2, 1, 1, "shelf"), 45000);
});

test("teklifler gün ve oyunla tohumlanır; itibar teklif sayısını artırır", () => {
  const g = initial(123456789);
  assert.deepEqual(generateOffers(g, 4), generateOffers(g, 4));
  assert.notDeepEqual(generateOffers(g, 4), generateOffers(g, 5));
  assert.equal(generateOffers(g, 4).length, 2);
  assert.equal(generateOffers({ ...g, rep: 50 }, 4).length, 3);
  assert.equal(generateOffers({ ...g, rep: 80 }, 4).length, 4);
  // Başlangıçta yalnız açık ürün (sandalye) teklif edilir.
  for (let d = 1; d < 40; d++)
    for (const o of generateOffers(g, d)) {
      assert.equal(o.product, "chair");
      assert.ok(o.dueDay > d && o.dueDay <= d + 3);
      assert.ok(o.price % 10000 === 0 && o.price > 0);
    }
  // Teklifler her zaman kârlı değildir.
  let losing = 0,
    winning = 0;
  for (let d = 1; d < 200; d++)
    for (const o of generateOffers(g, d)) {
      const cost =
        (catalog.chair.materials +
          catalog.chair.energy +
          catalog.chair.packaging) /
        10;
      const net = o.price * 0.95 - o.shipping - cost * o.qty;
      if (net < 0) losing++;
      else winning++;
    }
  assert.ok(
    losing > 5 && winning > losing,
    `losing=${losing} winning=${winning}`,
  );
});

test("kabul edilen teklif ikinci kez kabul edilemez; ret ve tek karşı teklif hakkı", () => {
  let g = withOffer(initial(0), offer());
  g = run(g, "accept", 0, { id: "1-9" });
  assert.equal(g.orders.length, 1);
  assert.equal(g.orders[0].price, 950000);
  assert.throws(() => run(g, "accept", 0, { id: "1-9" }), /geçerli değil/);
  let h = run(withOffer(initial(0), offer()), "decline", 0, { id: "1-9" });
  assert.deepEqual([h.offers.length, h.orders.length], [0, 0]);
  // Tavan yeterliyse karşı teklif %10 yüksek bedelle siparişe döner.
  h = run(withOffer(initial(0), offer()), "counter", 0, { id: "1-9" });
  assert.equal(h.orders[0].price, counterPrice(offer()));
  assert.equal(h.orders[0].price, 1045000);
  assert.throws(() => run(h, "counter", 0, { id: "1-9" }));
  // Tavan düşükse müşteri çekilir; tekrar denenemez.
  h = run(withOffer(initial(0), offer({ ceiling: 960000 })), "counter", 0, {
    id: "1-9",
  });
  assert.deepEqual([h.offers.length, h.orders.length], [0, 0]);
  // Aynı anda en fazla MAX_ORDERS sipariş.
  let k = initial(0);
  for (let i = 0; i < MAX_ORDERS; i++)
    k = run(withOffer(k, offer({ id: "1-" + i })), "accept", 0, {
      id: "1-" + i,
    });
  assert.throws(
    () => run(withOffer(k, offer({ id: "1-x" })), "accept", 0, { id: "1-x" }),
    /en fazla/,
  );
});

test("siparişe ayrılan stok toptancıya satılamaz; teslim doğru muhasebeleşir", () => {
  let g = chairs(initial(0));
  g = run(withOffer(g, offer()), "accept", g.last, { id: "1-9" });
  g = run(g, "reserve", g.last, { id: "1-9" });
  assert.deepEqual(
    [g.goods.chair.reserved, available(g, "chair"), g.orders[0].reserved],
    [10, 0, 10],
  );
  assert.throws(
    () => run(g, "sell", g.last, { product: "chair", qty: 1 }),
    /stok/,
  );
  assert.throws(() => run(g, "reserve", g.last, { id: "1-9" }), /zaten/);
  const before = g;
  g = run(g, "deliver", g.last, { id: "1-9" });
  // 9.500 TL bedel, %5 vergi 475 TL, nakliye 400 TL, maliyet 4.500 TL.
  assert.equal(g.cash, before.cash + 950000 - 47500 - 40000);
  assert.deepEqual(
    [g.income, g.tax, g.freight, g.cogs],
    [950000, 47500, 40000, 450000],
  );
  assert.equal(profit(g), 950000 - 47500 - 40000 - 450000);
  assert.deepEqual(g.goods.chair, { qty: 0, cost: 0, reserved: 0 });
  assert.deepEqual(
    [g.rep, g.delivered, g.orders.length],
    [START_REP + 3, 1, 0],
  );
  assert.throws(() => run(g, "deliver", g.last, { id: "1-9" }), /bulunamadı/);
});

test("stokta olmayan ürün teslim edilemez ve durum değişmez", () => {
  let g = run(withOffer(initial(0), offer({ qty: 20 })), "accept", 0, {
    id: "1-9",
  });
  assert.throws(() => run(g, "deliver", 0, { id: "1-9" }), /20 adet daha/);
  assert.throws(() => run(g, "reserve", 0, { id: "1-9" }), /hazır stok yok/);
  g = chairs(g);
  // Teslimde eksik kalan stok ayrılmaz; yarım teslim olmaz.
  assert.throws(() => run(g, "deliver", g.last, { id: "1-9" }), /10 adet daha/);
  g = run(g, "reserve", g.last, { id: "1-9" });
  assert.equal(g.orders[0].reserved, 10);
  validate(g);
});

test("süresi geçen sipariş bir kez cezalanır, itibar düşer, ayrılan stok serbest kalır", (t) => {
  const d = db(t);
  let g = openWorkshop(d, 0);
  const o = g.offers[0];
  g = apply(d, "accept", g.rev, 0, { id: o.id });
  const rep = g.rep;
  const late = (o.dueDay + 1 - 1) * DAY + 5; // teslim gününden sonraki günün başı
  g = resume(d, late);
  const fine = Math.round(o.price / 10);
  assert.equal(g.orders.length, 0);
  assert.equal(g.penalties, fine);
  assert.equal(g.rep, Math.max(0, rep - 2 * o.rep));
  const again = resume(d, late + 1000);
  assert.deepEqual(again, g);
  const rows = d.sql
    .prepare("SELECT kind FROM factory_log ORDER BY revision")
    .all()
    .map((x) => x.kind);
  assert.deepEqual(rows.slice(-2), ["payroll", "expire"]);
  assert.equal(
    d.getFirstSync("SELECT SUM(movement) AS c FROM factory_log").c,
    g.cash,
  );
});

test("tek ürünlü (v2) kayıt maliyeti kuruşu kuruşuna korunarak çok ürüne taşınır", (t) => {
  const v2 = {
    cash: 13966000,
    lots: 1,
    rawCost: 400000,
    chairs: 6,
    goodsCost: 270000,
    staff: 2,
    workers: 1,
    level: 1,
    job: 10,
    wip: 450000,
    ready: 90000,
    born: 0,
    last: 30000,
    marketDay: 1,
    taken: 4,
    sold: 4,
    income: 340000,
    cogs: 180000,
    tax: 17000,
    freight: 12000,
    investment: 0,
    wages: 45000,
    paidDay: 1,
    rev: 9,
  };
  const g = upgradeGame(v2);
  validate(g);
  assert.deepEqual(g.materials, {
    board: { qty: 20, cost: 300000 },
    kit: { qty: 10, cost: 100000 },
  });
  assert.deepEqual(g.goods.chair, { qty: 6, cost: 270000, reserved: 0 });
  assert.deepEqual(
    [g.jobProduct, g.taken.chair, g.rep, g.orders.length],
    ["chair", 4, START_REP, 0],
  );
  assert.ok(g.offers.length >= 2);
  for (const k of ["lots", "rawCost", "chairs", "goodsCost"])
    assert.equal(k in g, false);
  // Mobil SQLite: eski JSON okunur, ilk işlemle yeni biçimde yazılır.
  const d = db(t);
  openWorkshop(d, 0);
  d.runSync(
    "UPDATE factory_save SET data=?, revision=? WHERE id=1",
    JSON.stringify(v2),
    9,
  );
  d.runSync(
    "UPDATE factory_log SET revision=9, balance=? WHERE revision=0",
    v2.cash,
  );
  let h = read(d);
  assert.equal(h.goods.chair.qty, 6);
  h = resume(d, 90000);
  assert.equal(h.goods.chair.qty, 16);
  assert.equal(
    JSON.parse(d.getFirstSync("SELECT data FROM factory_save").data).goods.chair
      .qty,
    16,
  );
});

function simulate(policy, steps, seed0) {
  let seed = seed0;
  const rand = () =>
    (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let g = initial(0),
    now = 0,
    ok = 0;
  for (let step = 0; step < steps; step++) {
    now += Math.floor(rand() * 20000);
    for (let auto = due(g, now); auto; auto = due(g, now))
      g = advance(g, auto, now);
    for (const [cmd, arg] of policy(g, rand, now)) {
      try {
        const next = advance(g, cmd, now, arg);
        assert.equal(next.rev, g.rev + 1);
        g = next;
        ok++;
      } catch (e) {
        // Yalnız oyunun kendi kuralları reddedebilir; tutarlılık hatası asla olmamalı.
        assert.doesNotMatch(String(e.message), /tutarsız|doğrulanamadı/);
      }
      assert.ok(g.cash >= 0);
      for (const p of products)
        assert.ok(g.goods[p].qty >= g.goods[p].reserved);
    }
  }
  validate(g);
  return { g, ok, now };
}
const pick = (rand, a) => a[Math.floor(rand() * a.length)];

test("uzun kaotik simülasyon: bedava para, negatif stok veya tutarsız kayıt yok", () => {
  const all = [
    "buy",
    "hire",
    "fire",
    "assign",
    "unassign",
    "start",
    "sell",
    "upgrade",
    "salvage",
    "accept",
    "decline",
    "counter",
    "reserve",
    "deliver",
  ];
  const { g, now } = simulate(
    (g, rand) => {
      const cmd = pick(rand, all);
      const id = ["accept", "decline", "counter"].includes(cmd)
        ? g.offers[0]?.id
        : g.orders[0]?.id;
      return [
        [
          cmd,
          {
            product: pick(rand, products),
            qty: 1 + Math.floor(rand() * (cmd === "sell" ? 15 : 3)),
            id,
          },
        ],
      ];
    },
    6000,
    7,
  );
  assert.ok(day(g, now) > 50);
});

test("makul oyuncu üretir, sipariş teslim eder, büyür; kasa ve defter tutarlı kalır", () => {
  const { g } = simulate(
    (g, rand, now) => {
      const acts = [];
      const open = products.filter((p) => !lockReason(g, p));
      const p = pick(rand, open);
      if (g.workers < Math.min(g.staff, g.level + 1)) acts.push(["assign", {}]);
      if (g.staff < g.level + 1 && g.cash > 2000000) acts.push(["hire", {}]);
      if (lotsOf(g, p) < g.level && g.cash > 1500000)
        acts.push(["buy", { product: p }]);
      if (rand() < 0.3) acts.push(["upgrade", {}]);
      acts.push([
        "start",
        { product: p, qty: Math.min(g.level, g.workers, lotsOf(g, p)) || 1 },
      ]);
      for (const o of g.offers) {
        const unit =
          (catalog[o.product].materials +
            catalog[o.product].energy +
            catalog[o.product].packaging) /
          catalog[o.product].batch;
        acts.push([
          o.price * 0.95 - o.shipping > unit * o.qty * 1.2
            ? "accept"
            : "decline",
          { id: o.id },
        ]);
      }
      for (const o of g.orders) acts.push(["deliver", { id: o.id }]);
      for (const q of products)
        acts.push([
          "sell",
          {
            product: q,
            qty: Math.max(
              1,
              available(g, q) -
                g.orders
                  .filter((o) => o.product === q)
                  .reduce((s, o) => s + o.qty - o.reserved, 0),
            ),
          },
        ]);
      return acts;
    },
    3000,
    11,
  );
  assert.ok(
    g.delivered >= 10 && g.sold > 300,
    `delivered=${g.delivered} sold=${g.sold}`,
  );
  // Kasa üretime ve stoğa bağlanabilir; büyüme özkaynakla (sermaye + kâr) ölçülür.
  assert.ok(
    g.level >= 2 && profit(g) > CAPITAL,
    `level=${g.level} profit=${profit(g)}`,
  );
  assert.ok(
    products.every((p) => !lockReason(g, p)),
    "tüm ürünler açılmalı",
  );
});

test("kasası tükenen atölye malzemesini elden çıkarıp yeniden üretebilir (kilitlenme yok)", () => {
  let g = initial(0);
  while (g.cash >= catalog.chair.materials)
    g = run(g, "buy", 0, { product: "chair" });
  while (g.cash >= 45000 && g.staff < 6) g = run(g, "hire", 0);
  while (g.staff) g = run(g, "fire", 0);
  assert.deepEqual([g.staff, g.cash < 45000], [0, true]);
  assert.throws(() => run(g, "hire", 0), /bakiye/);
  const before = g;
  g = run(g, "salvage", 0, { product: "chair", qty: 1 });
  assert.equal(g.cash, before.cash + 240000);
  assert.equal(g.writeoffs, 160000);
  g = run(g, "hire", 0);
  g = run(g, "assign", 0);
  g = run(g, "start", 0, { product: "chair" });
  g = run(g, "finish", g.ready);
  g = run(g, "sell", g.last, { product: "chair", qty: 10 });
  assert.ok(g.cash > before.cash);
});
