import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { openWorkshop, apply, resume } from "../src/store.ts";
import {
  advance,
  credit,
  creditLimit,
  debt,
  due,
  equity,
  initial,
  loanQuote,
  market,
  nextInstallment,
  profit,
  upgradeGame,
  validate,
  CAPITAL,
  DAY,
  MAX_LOANS,
  WAGE,
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
/** Bekleyen otomatik adımları (maaş, banka günü, sipariş, üretim) işler. */
function tick(g, now) {
  for (let a = due(g, now); a; a = due(g, now)) g = run(g, a, now);
  return g;
}
const TL = 100;

test("kasa–banka transferi gelir/gider değildir; mevduat günlük %0,2 faiz alır", () => {
  let g = initial(0);
  g = run(g, "deposit", 0, 100000 * TL);
  assert.deepEqual([g.cash, g.bank, profit(g)], [50000 * TL, 100000 * TL, 0]);
  assert.throws(() => run(g, "deposit", 0, 60000 * TL), /Kasada/);
  assert.throws(() => run(g, "withdraw", 0, 100001 * TL), /Bankada/);
  g = run(g, "withdraw", 0, 20000 * TL);
  assert.deepEqual([g.cash, g.bank, profit(g)], [70000 * TL, 80000 * TL, 0]);
  g = tick(g, DAY); // gün 2: maaş kasadan, mevduata bir günlük faiz
  assert.equal(g.interestIncome, 160 * TL);
  assert.equal(g.bank, 80160 * TL);
  assert.equal(g.cash, 70000 * TL - WAGE);
  assert.equal(profit(g), 160 * TL - WAGE);
});

test("başlangıç notu 600, limit özkaynağın %30'u; not faizi ve limiti belirler", () => {
  const g = initial(0);
  assert.equal(credit(g).score, 600);
  assert.equal(creditLimit(g), 45000 * TL);
  const q = loanQuote(g, "isletme", 20000 * TL);
  assert.deepEqual(
    [q.rate, q.interest, q.total, q.days, q.installment],
    [400, 800 * TL, 20800 * TL, 5, 4160 * TL],
  );
  // Daha iyi not: daha düşük faiz, daha yüksek limit.
  const good = { ...g, onTime: 25, delivered: 20 };
  assert.equal(credit(good).score, 810);
  assert.ok(loanQuote(good, "isletme", 20000 * TL).rate < 400);
  assert.ok(creditLimit(good) > creditLimit(g));
  const bad = { ...g, late: 6 };
  assert.equal(credit(bad).score, 360);
  assert.equal(creditLimit(bad), 0);
  assert.match(loanQuote(bad, "isletme", 20000 * TL).reason, /400 altında/);
});

test("kredi nakit ve borcu birlikte artırır; kâr değişmez; limit, tür ve onay kontrolü", () => {
  let g = initial(0);
  const q = loanQuote(g, "isletme", 20000 * TL);
  assert.throws(
    () =>
      run(g, "borrow", 0, {
        loan: "isletme",
        qty: 20000 * TL,
        quote: q.total + 1,
      }),
    /koşulları değişti/,
  );
  g = run(g, "borrow", 0, { loan: "isletme", qty: 20000 * TL, quote: q.total });
  assert.deepEqual(
    [g.cash, debt(g), profit(g), equity(g)],
    [170000 * TL, 20000 * TL, 0, CAPITAL],
  );
  assert.throws(
    () => run(g, "borrow", 0, { loan: "isletme", qty: 30000 * TL }),
    /limiti/,
  );
  assert.throws(
    () => run(g, "borrow", 0, { loan: "leasing", qty: 1000 * TL }),
    /Geçersiz kredi/,
  );
  assert.throws(
    () => run(g, "borrow", 0, { loan: "isletme", qty: 4000 * TL }),
    /düşük/,
  );
  assert.match(loanQuote(g, "buyume", 40000 * TL).reason, /düşük/);
  // Borç arttıkça not düşer ve limit daralır.
  assert.ok(credit(g).score < 600 && creditLimit(g) < 25000 * TL);
  for (let i = 1; i < MAX_LOANS; i++)
    g = run(g, "borrow", 0, { loan: "isletme", qty: 5000 * TL });
  assert.throws(
    () => run(g, "borrow", 0, { loan: "isletme", qty: 1000000 }),
    /en fazla 3/,
  );
  validate(g);
});

test("taksitler her oyun gününde bir kez ödenir, faiz gider yazılır, kredi kapanır", (t) => {
  const d = db(t);
  let g = openWorkshop(d, 0);
  g = apply(d, "borrow", g.rev, 0, { loan: "isletme", qty: 20000 * TL });
  const id = g.loans[0].id;
  for (let day = 1; day <= 5; day++) {
    g = resume(d, day * DAY);
    assert.deepEqual(
      resume(d, day * DAY + 1000),
      g,
      "aynı gün ikinci kez işlenmez",
    );
    if (day < 5) assert.equal(g.loans[0].left, 5 - day);
  }
  assert.equal(g.loans.length, 0);
  assert.deepEqual(
    [g.interest, g.onTime, g.late, debt(g)],
    [800 * TL, 5, 0, 0],
  );
  assert.equal(g.cash, CAPITAL + 20000 * TL - 20800 * TL - 5 * WAGE);
  assert.ok(credit(g).score > 600);
  const kinds = d.sql
    .prepare("SELECT kind FROM factory_log ORDER BY revision")
    .all()
    .map((r) => r.kind);
  assert.equal(kinds.filter((k) => k === "bank").length, 5);
  assert.equal(
    d.getFirstSync("SELECT SUM(movement) AS c FROM factory_log").c,
    g.cash,
  );
  assert.ok(id.startsWith("K"));
});

test("ödenemeyen taksit gecikme bedeli doğurur, notu düşürür, yeni krediyi engeller; kapalı kalınca en fazla 3 gün", () => {
  let g = run(initial(0), "borrow", 0, { loan: "isletme", qty: 20000 * TL });
  // Bütün nakit malzemeye bağlanır: taksit ödenemez.
  while (g.cash >= 400000) g = run(g, "buy", 0, { product: "chair" });
  g = run(g, "fire", 0);
  const cash = g.cash,
    before = g.loans[0];
  assert.ok(cash < nextInstallment(before).total);
  g = tick(g, 30 * DAY);
  const l = g.loans[0];
  assert.equal(l.missed, 3, "30 günlük boşlukta yalnız 3 gün işlenir");
  assert.equal(g.late, 3);
  assert.ok(l.balance > before.balance);
  assert.equal(g.lateFees, l.balance - before.balance);
  assert.equal(g.cash, cash);
  assert.ok(credit(g).score < 600 - 120);
  assert.equal(creditLimit(g), 0);
  assert.throws(() =>
    run(g, "borrow", g.last, { loan: "isletme", qty: 1000000 }),
  );
  validate(g);
  // Malzemeyi elden çıkarıp borcu kapatmak mümkün.
  while (g.materials.board.qty)
    g = run(g, "salvage", g.last, { product: "chair" });
  g = run(g, "repay", g.last, { id: l.id, qty: l.balance });
  assert.deepEqual([g.loans.length, debt(g)], [0, 0]);
});

test("erken ödeme kalan faizi orantılı siler, ceza yoktur", () => {
  let g = run(initial(0), "borrow", 0, { loan: "isletme", qty: 40000 * TL });
  const l = g.loans[0];
  assert.equal(l.interestLeft, 1600 * TL);
  g = run(g, "repay", 0, { id: l.id, qty: 20000 * TL });
  assert.deepEqual(
    [g.loans[0].balance, g.loans[0].interestLeft],
    [20000 * TL, 800 * TL],
  );
  g = run(g, "repay", 0, { id: l.id, qty: 99999999 });
  assert.equal(g.loans.length, 0);
  assert.deepEqual([g.interest, profit(g), g.cash], [0, 0, CAPITAL]);
});

test("makine finansmanı: kazanç birikmeden makine geliştirilir; borç ve varlık birlikte artar", () => {
  let g = initial(0);
  assert.throws(() => run(g, "upgrade", 0), /kazanç/);
  const q = loanQuote(g, "leasing", 300000);
  g = run(g, "upgrade", 0, { loan: "leasing", quote: q.total });
  assert.deepEqual(
    [g.level, g.investment, debt(g), g.cash, profit(g)],
    [2, 300000, 300000, CAPITAL, 0],
  );
  assert.equal(g.loans[0].kind, "leasing");
  assert.equal(g.loans[0].left, 10);
});

test("banka öncesi (v3) kayıt boş hesap ve kredisiz taşınır", () => {
  const old = initial(0);
  for (const k of [
    "bank",
    "loans",
    "interest",
    "lateFees",
    "interestIncome",
    "onTime",
    "late",
    "bankDay",
  ])
    delete old[k];
  const g = upgradeGame(old);
  validate(g);
  assert.deepEqual(
    [g.bank, g.loans, g.bankDay, credit(g).score],
    [0, [], 1, 600],
  );
});

test("borç alıp mevduata koymak kâr getirmez (kredisiz mevduatla karşılaştırma)", () => {
  const park = (borrow) => {
    let g = initial(0);
    if (borrow)
      g = run(g, "borrow", 0, { loan: "isletme", qty: creditLimit(g) });
    g = run(g, "deposit", 0, g.cash - 10000 * TL);
    for (let day = 1; day <= 6; day++) g = tick(g, day * DAY);
    validate(g);
    return g;
  };
  const own = park(false),
    levered = park(true);
  assert.equal(levered.loans.length, 0);
  assert.ok(
    profit(levered) < profit(own),
    `${profit(levered)} < ${profit(own)}`,
  );
});

test("aşırı borçlanma: krediyle alınan ve satılamayan stok özkaynağı eritir, not düşer", () => {
  let g = initial(0);
  g = run(g, "borrow", 0, { loan: "isletme", qty: creditLimit(g) });
  while (g.cash >= 400000) g = run(g, "buy", 0, { product: "chair" });
  for (let day = 1; day <= 8; day++) g = tick(g, day * DAY);
  assert.ok(
    g.late > 0 && credit(g).score < 500,
    `late=${g.late} score=${credit(g).score}`,
  );
  assert.ok(equity(g) < CAPITAL);
  validate(g);
});

test("doğru yatırım: kredi ve makine finansmanıyla büyüyen atölye taksitlerini zamanında öder", () => {
  let g = initial(0);
  g = run(g, "borrow", 0, { loan: "isletme", qty: 30000 * TL });
  g = run(g, "upgrade", 0, { loan: "leasing" });
  g = run(g, "hire", 0);
  g = run(g, "assign", 0);
  g = run(g, "assign", 0);
  let now = 0;
  for (let step = 0; step < 20 * 12; step++) {
    now += DAY / 12;
    g = tick(g, now);
    const tryRun = (cmd, arg) => {
      try {
        g = run(g, cmd, now, arg);
      } catch {
        /* kurala takılan adım atlanır */
      }
    };
    // Talep kadar üretip satar; stok iki günlük talebi aşınca üretmez.
    const demand = market(g, now, "chair").demand;
    if (g.goods.chair.qty < 60) {
      if (g.materials.board.qty < 40)
        tryRun("buy", { product: "chair", qty: 2 });
      tryRun("start", { product: "chair", qty: 2 });
    }
    const left = g.goods.chair.qty - g.goods.chair.reserved;
    if (left && demand)
      tryRun("sell", { product: "chair", qty: Math.min(left, demand) });
  }
  assert.equal(g.late, 0, "hiç taksit gecikmedi");
  assert.equal(g.loans.length, 0, "krediler vadesinde kapandı");
  assert.ok(g.onTime >= 15);
  assert.ok(equity(g) > CAPITAL + 30000 * TL, `özkaynak ${equity(g)}`);
  assert.ok(credit(g).score > 650, `not ${credit(g).score}`);
  validate(g);
});
