import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openWorkshop, apply, resume, read } from "../src/store.ts";
import {
  CAPITAL,
  DAY,
  WAGE,
  MAX_STAFF,
  profit,
  market,
  duration,
  cycle,
  lotsOf,
  seats,
} from "../src/workshop.ts";

function db(t, path = ":memory:") {
  const sql = new DatabaseSync(path);
  t.after(() => {
    if (sql.isOpen) sql.close();
  });
  return {
    sql,
    execSync: (q) => sql.exec(q),
    getFirstSync: (q) => sql.prepare(q).get(),
    runSync: (q, ...args) => sql.prepare(q).run(...args),
  };
}
function file(t) {
  const dir = mkdtempSync(join(tmpdir(), "fabrikator-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, "factory.db");
}
function started(d) {
  let g = openWorkshop(d, 0);
  assert.equal(g.cash, CAPITAL);
  g = apply(d, "buy", g.rev, 1);
  assert.equal(g.cash, 14600000);
  g = apply(d, "assign", g.rev, 2);
  g = apply(d, "start", g.rev, 3);
  assert.deepEqual(
    [g.cash, g.wip, lotsOf(g), g.goods.chair.qty],
    [14550000, 450000, 0, 0],
  );
  return g;
}
test("ilk satış: iki kez harcama yok; 8500 gelir, 425 vergi, 300 nakliye ve 3275 TL kazanç", (t) => {
  const d = db(t);
  let g = started(d);
  g = resume(d, g.ready);
  assert.deepEqual(
    [g.goods.chair.qty, g.goods.chair.cost, g.wip],
    [10, 450000, 0],
  );
  g = apply(d, "sell", g.rev, g.last, 10);
  assert.deepEqual(
    [g.goods.chair.qty, g.cash, g.income, g.cogs, g.tax, g.freight, profit(g)],
    [0, 15327500, 850000, 450000, 42500, 30000, 327500],
  );
  assert.equal(
    d.getFirstSync("SELECT SUM(movement) AS cash FROM factory_log").cash,
    g.cash,
  );
});
test("kapalı geçen süre, tamamlanma sınırı ve tekrar açılış tek teslim oluşturur", (t) => {
  const path = file(t),
    a = db(t, path),
    g = started(a);
  a.sql.close();
  const b = db(t, path);
  assert.deepEqual(openWorkshop(b, g.ready - 1), g);
  const done = openWorkshop(b, g.ready + DAY);
  assert.equal(done.goods.chair.qty, 10);
  assert.equal(done.ready, 0);
  // Ertesi günün maaşı bir kez kesilir; aynı gün yeniden açmak hiçbir şeyi değiştirmez.
  assert.equal(done.cash, 14550000 - WAGE);
  assert.deepEqual(openWorkshop(b, g.ready + DAY + 1000), done);
  const later = openWorkshop(b, g.ready + 2 * DAY);
  assert.deepEqual(
    [later.goods.chair.qty, later.cash, later.wages],
    [10, done.cash - WAGE, 2 * WAGE],
  );
});
test("aynı sürümle iki bağlantıdan verilen sipariş ve satış bir kez işlenir", (t) => {
  const path = file(t),
    a = db(t, path),
    b = db(t, path);
  let g = openWorkshop(a, 0);
  apply(a, "buy", g.rev, 0);
  assert.throws(() => apply(b, "buy", g.rev, 0));
  g = read(b);
  g = apply(b, "assign", g.rev, 1);
  g = apply(b, "start", g.rev, 2);
  g = resume(a, g.ready);
  for (const n of [-1, 0, 1.5, 11])
    assert.throws(() => apply(b, "sell", g.rev, g.last, n));
  const sale = apply(a, "sell", g.rev, g.last, 6);
  assert.throws(() => apply(b, "sell", g.rev, g.last, 6));
  assert.equal(market(sale, sale.last).demand, 4);
  assert.equal(sale.goods.chair.qty, 4);
});
test("usta, kapasite, zaman ve günlük talep; ilk kazançla yeni makine", (t) => {
  const d = db(t);
  let g = openWorkshop(d, 0);
  assert.throws(() => apply(d, "upgrade", g.rev, 0));
  g = apply(d, "buy", g.rev, 0);
  assert.throws(() => apply(d, "start", g.rev, 0));
  g = apply(d, "assign", g.rev, 0);
  assert.throws(() => apply(d, "start", g.rev, 0, 2));
  g = apply(d, "start", g.rev, 0);
  assert.throws(() => apply(d, "finish", g.rev, 10));
  assert.throws(() => apply(d, "assign", g.rev, 10));
  g = resume(d, g.ready);
  g = apply(d, "sell", g.rev, g.last, 10);
  g = apply(d, "upgrade", g.rev, g.last);
  assert.equal(g.investment, 300000);
  assert.equal(duration(g), 30000);
  for (let i = 0; i < 2; i++) g = apply(d, "buy", g.rev, g.last);
  // Seviye 2 makine iki parti alır ama tek çalışan bir partiyi yürütür.
  assert.throws(() => apply(d, "start", g.rev, g.last, 2));
  g = apply(d, "hire", g.rev, g.last);
  g = apply(d, "assign", g.rev, g.last);
  g = apply(d, "start", g.rev, g.last, 2);
  assert.equal(g.job, 20);
  assert.equal(g.ready - g.last, 30000);
  g = resume(d, g.ready);
  assert.throws(() => apply(d, "sell", g.rev, g.last, 1));
  assert.deepEqual(market(g, DAY), { day: 2, price: 89250, demand: 30 });
  g = apply(d, "sell", g.rev, DAY, 20);
  assert.equal(g.goods.chair.qty, 0);
  assert.equal(market(g, DAY).demand, 10);
});
test("yetersiz kasa ham maddeyi eksiye düşürmez", (t) => {
  const d = db(t);
  let g = openWorkshop(d, 0);
  while (g.cash >= 400000) g = apply(d, "buy", g.rev, 0);
  assert.throws(() => apply(d, "buy", g.rev, 0));
  assert.deepEqual(read(d), g);
});
test("hareket yazımı başarısız olursa stok ve kasa da geri alınır", (t) => {
  const d = db(t);
  const before = openWorkshop(d, 0);
  d.execSync(
    "CREATE TRIGGER stop BEFORE INSERT ON factory_log BEGIN SELECT RAISE(ABORT,'kesinti'); END;",
  );
  assert.throws(() => apply(d, "buy", before.rev, 0));
  assert.deepEqual(read(d), before);
});
test("bozuk kayıt açılışta ezilmez", (t) => {
  const d = db(t);
  openWorkshop(d, 0);
  d.execSync("UPDATE factory_save SET data='{}'");
  assert.throws(() => openWorkshop(d, 1));
  assert.equal(d.getFirstSync("SELECT data FROM factory_save").data, "{}");
});
test("ilk prototipin süren işi, eski maliyeti ve geçmiş kârı taşınır", (t) => {
  const d = db(t);
  d.execSync(
    "CREATE TABLE workshop(id,cash,boards,kits,ready_at,chairs,sold,profit);INSERT INTO workshop VALUES(1,120000,0,0,60000,0,10,50000)",
  );
  const g = openWorkshop(d, 100);
  assert.equal(g.job, 10);
  assert.equal(profit(g), 50000);
  assert.equal(g.cash, 14920000);
  assert.equal(resume(d, 60000).goods.chair.cost, 130000);
});

test("çalışan al, hatta ata, koltuk ve atölye sınırı; boştaki çalışan ayrılır", (t) => {
  const d = db(t);
  let g = openWorkshop(d, 0);
  assert.deepEqual([g.staff, g.workers], [1, 0]);
  assert.throws(() => apply(d, "unassign", g.rev, 0));
  g = apply(d, "fire", g.rev, 0); // boştaki tek çalışan ayrılabilir
  assert.equal(g.staff, 0);
  assert.throws(() => apply(d, "assign", g.rev, 0));
  for (let i = 0; i < MAX_STAFF; i++) g = apply(d, "hire", g.rev, 0);
  assert.equal(g.cash, CAPITAL - MAX_STAFF * WAGE);
  assert.equal(profit(g), -MAX_STAFF * WAGE);
  assert.throws(() => apply(d, "hire", g.rev, 0));
  g = apply(d, "assign", g.rev, 0);
  g = apply(d, "assign", g.rev, 0);
  assert.equal(seats(g.level), 2);
  assert.throws(() => apply(d, "assign", g.rev, 0));
  g = apply(d, "buy", g.rev, 0);
  g = apply(d, "start", g.rev, 0);
  assert.equal(g.ready - g.last, 30000);
  for (const cmd of ["assign", "unassign"])
    assert.throws(() => apply(d, cmd, g.rev, 1));
  g = apply(d, "fire", g.rev, 1);
  assert.deepEqual([g.staff, g.workers], [MAX_STAFF - 1, 2]);
  g = resume(d, g.ready);
  g = apply(d, "unassign", g.rev, g.last);
  g = apply(d, "unassign", g.rev, g.last);
  for (let i = 0; i < MAX_STAFF - 1; i++) g = apply(d, "fire", g.rev, g.last);
  assert.throws(() => apply(d, "fire", g.rev, g.last));
  assert.equal(g.staff, 0);
});

test("çalışan sayısı çevrim süresini makine sınırına kadar kısaltır", () => {
  assert.equal(cycle(1, 1, 1), 60000);
  assert.equal(cycle(1, 1, 2), 30000);
  assert.equal(cycle(2, 2, 1), 60000);
  assert.equal(cycle(2, 2, 2), 30000);
  assert.equal(cycle(2, 2, 3), 20000);
  assert.equal(cycle(3, 3, 4), 15000);
  assert.deepEqual([seats(1), seats(2), seats(3)], [2, 3, 4]);
});

test("maaş her yeni gün bir kez, kapalı kalınca en fazla üç gün kesilir", (t) => {
  const d = db(t);
  let g = openWorkshop(d, 0);
  g = apply(d, "hire", g.rev, 0);
  assert.equal(g.cash, CAPITAL - WAGE);
  g = resume(d, DAY - 1);
  assert.equal(g.cash, CAPITAL - WAGE);
  g = resume(d, DAY);
  assert.equal(g.cash, CAPITAL - 3 * WAGE);
  g = resume(d, DAY + 1);
  assert.equal(g.cash, CAPITAL - 3 * WAGE);
  g = resume(d, 30 * DAY);
  assert.equal(g.cash, CAPITAL - 3 * WAGE - 3 * 2 * WAGE);
  assert.equal(g.cash + g.wages, CAPITAL);
  assert.equal(
    d.getFirstSync("SELECT SUM(movement) AS cash FROM factory_log").cash,
    g.cash,
  );
});

test("kasa maaşa yetmezse ödenemeyen çalışan ayrılır, kasa eksiye düşmez", (t) => {
  const d = db(t);
  let g = openWorkshop(d, 0);
  g = apply(d, "hire", g.rev, 0);
  while (g.cash >= 400000) g = apply(d, "buy", g.rev, 0);
  g = apply(d, "assign", g.rev, 0);
  for (let day = 1; day < 40 && g.staff; day++) g = resume(d, day * DAY);
  assert.ok(g.cash >= 0);
  assert.ok(g.cash < WAGE);
  assert.equal(g.staff, 0);
  assert.equal(g.workers, 0);
});

test("çalışan sistemi öncesi mobil kayıt bir usta ile taşınır ve geçmiş maaş kesilmez", (t) => {
  const d = db(t);
  let g = started(d);
  const old = JSON.parse(d.getFirstSync("SELECT data FROM factory_save").data);
  for (const key of ["staff", "wages", "paidDay"]) delete old[key];
  d.runSync("UPDATE factory_save SET data=?", JSON.stringify(old));
  g = read(d);
  assert.deepEqual([g.staff, g.workers, g.wages, g.paidDay], [1, 1, 0, 1]);
  g = resume(d, g.ready);
  assert.equal(g.goods.chair.qty, 10);
  assert.equal(
    JSON.parse(d.getFirstSync("SELECT data FROM factory_save").data).staff,
    1,
  );
});

test("yeni günde verilen sipariş, maaşı ayrı hareket olarak önce yazar", (t) => {
  const d = db(t);
  let g = openWorkshop(d, 0);
  g = apply(d, "buy", g.rev, DAY + 5);
  const rows = d.sql
    .prepare("SELECT kind, movement FROM factory_log ORDER BY revision")
    .all()
    .map((row) => [row.kind, row.movement]);
  assert.deepEqual(rows, [
    ["opening", CAPITAL],
    ["payroll", -WAGE],
    ["buy", -400000],
  ]);
  assert.equal(g.cash, CAPITAL - WAGE - 400000);
});

test("yeni günde biten üretim, maaşı kendi satırında gösterir", (t) => {
  const d = db(t);
  let g = started(d);
  g = resume(d, DAY + 1);
  const rows = d.sql
    .prepare("SELECT kind, movement FROM factory_log ORDER BY revision")
    .all()
    .map((row) => [row.kind, row.movement]);
  assert.deepEqual(rows.slice(-2), [
    ["payroll", -WAGE],
    ["finish", 0],
  ]);
  assert.equal(g.goods.chair.qty, 10);
});
