import {
  advance,
  CAPITAL,
  initial,
  validate,
  type Command,
  type Game,
} from "./workshop.ts";

type DB = {
  execSync(sql: string): void;
  getFirstSync<T>(sql: string): T | null;
  runSync(sql: string, ...params: (number | string)[]): { changes: number };
};
export type Entry = {
  revision: number;
  kind: string;
  movement: number;
  balance: number;
  at: number;
};
function transaction<T>(db: DB, work: () => T) {
  db.execSync("BEGIN IMMEDIATE");
  try {
    const value = work();
    db.execSync("COMMIT");
    return value;
  } catch (error) {
    db.execSync("ROLLBACK");
    throw error;
  }
}
function legacy(db: DB, now: number) {
  const g = initial(now);
  if (
    !db.getFirstSync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='workshop'",
    )
  )
    return g;
  const old = db.getFirstSync<{
    cash: number;
    boards: number;
    kits: number;
    ready_at: number | null;
    chairs: number;
    sold: number;
    profit: number;
  }>("SELECT * FROM workshop WHERE id=1");
  if (
    !old ||
    old.boards !== old.kits * 2 ||
    old.kits % 10 ||
    old.profit !== old.sold * 5000
  )
    throw new Error("Önceki kayıt okunamadı.");
  g.cash = old.cash + CAPITAL - 200000;
  g.lots = old.kits / 10;
  g.rawCost = g.lots * 100000;
  g.chairs = old.chairs;
  g.goodsCost = g.chairs * 13000;
  g.sold = old.sold;
  g.income = g.sold * 18000;
  g.cogs = g.sold * 13000;
  if (old.ready_at !== null) {
    g.workers = 1;
    g.ready = old.ready_at;
    g.wip = 130000;
    g.job = 10;
  }
  return g;
}
export function read(db: DB) {
  const row = db.getFirstSync<{ data: string; revision: number }>(
    "SELECT data,revision FROM factory_save WHERE id=1",
  );
  if (!row) throw new Error("Atölye kaydı eksik.");
  const game: Game = JSON.parse(row.data);
  validate(game);
  if (game.rev !== row.revision) throw new Error("Atölye sürümü tutarsız.");
  return game;
}
function record(db: DB, g: Game, kind: string, movement: number) {
  db.runSync(
    "INSERT INTO factory_log(revision,kind,movement,balance,at) VALUES(?,?,?,?,?)",
    g.rev,
    kind,
    movement,
    g.cash,
    g.last,
  );
}
export function openWorkshop(db: DB, now = Date.now()) {
  transaction(db, () => {
    if (
      db.getFirstSync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='factory_save'",
      )
    ) {
      const g = read(db);
      const entry = db.getFirstSync<Entry>(
        "SELECT * FROM factory_log ORDER BY revision DESC LIMIT 1",
      );
      if (entry?.revision !== g.rev || entry.balance !== g.cash)
        throw new Error("Hareket defteri kayıtla eşleşmiyor.");
      return;
    }
    const g = legacy(db, now);
    validate(g);
    db.execSync(`CREATE TABLE factory_save(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,data TEXT NOT NULL);
      CREATE TABLE factory_log(revision INTEGER PRIMARY KEY,kind TEXT NOT NULL,movement INTEGER NOT NULL,balance INTEGER NOT NULL,at INTEGER NOT NULL);`);
    db.runSync(
      "INSERT INTO factory_save VALUES(1,?,?)",
      g.rev,
      JSON.stringify(g),
    );
    record(db, g, "opening", g.cash);
  });
  return resume(db, now);
}
export function apply(
  db: DB,
  cmd: Command,
  rev: number,
  now = Date.now(),
  qty = 1,
) {
  return transaction(db, () => {
    const prev = read(db);
    if (prev.rev !== rev)
      throw new Error("Bu işlem zaten işlendi. Güncel kaydı kontrol edin.");
    const g = advance(prev, cmd, now, qty);
    db.runSync(
      "UPDATE factory_save SET revision=?,data=? WHERE id=1",
      g.rev,
      JSON.stringify(g),
    );
    record(db, g, cmd, g.cash - prev.cash);
    return g;
  });
}
export function resume(db: DB, now = Date.now()) {
  const g = read(db);
  return g.job && now >= g.ready ? apply(db, "finish", g.rev, now) : g;
}
