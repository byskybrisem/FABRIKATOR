import {
  advance,
  CAPITAL,
  due,
  initial,
  upgradeGame,
  validate,
  type Arg,
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
function legacy(db: DB, now: number): Game {
  const fresh = initial(now);
  if (
    !db.getFirstSync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='workshop'",
    )
  )
    return fresh;
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
  // İlk prototipin tablosu tek ürünlü biçime çevrilip ortak taşıma adımından geçer.
  const lots = old.kits / 10;
  const running = old.ready_at !== null;
  return upgradeGame({
    cash: old.cash + CAPITAL - 200000,
    lots,
    rawCost: lots * 100000,
    chairs: old.chairs,
    goodsCost: old.chairs * 13000,
    workers: running ? 1 : 0,
    level: 1,
    job: running ? 10 : 0,
    wip: running ? 130000 : 0,
    ready: running ? old.ready_at : 0,
    born: now,
    last: now,
    marketDay: 1,
    taken: 0,
    sold: old.sold,
    income: old.sold * 18000,
    cogs: old.sold * 13000,
    tax: 0,
    freight: 0,
    investment: 0,
    rev: 0,
  });
}
export function read(db: DB) {
  const row = db.getFirstSync<{ data: string; revision: number }>(
    "SELECT data,revision FROM factory_save WHERE id=1",
  );
  if (!row) throw new Error("Atölye kaydı eksik.");
  // Çalışan sistemi öncesindeki kayıtlar okunurken tamamlanır; ilk işlemde yeni biçimle yazılır.
  const game: Game = upgradeGame(JSON.parse(row.data));
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
  arg: number | Arg = {},
) {
  return transaction(db, () => {
    let prev = read(db);
    if (prev.rev !== rev)
      throw new Error("Bu işlem zaten işlendi. Güncel kaydı kontrol edin.");
    // Biten üretim ve yeni günün maaşı, oyuncunun işleminden önce ayrı satırlar olarak yazılır.
    for (
      let auto = due(prev, now);
      auto && auto !== cmd;
      auto = due(prev, now)
    ) {
      const step = advance(prev, auto, now);
      save(db, step, auto, step.cash - prev.cash);
      prev = step;
    }
    const g = advance(prev, cmd, now, arg);
    save(db, g, cmd, g.cash - prev.cash);
    return g;
  });
}
function save(db: DB, g: Game, kind: string, movement: number) {
  db.runSync(
    "UPDATE factory_save SET revision=?,data=? WHERE id=1",
    g.rev,
    JSON.stringify(g),
  );
  record(db, g, kind, movement);
}
export function resume(db: DB, now = Date.now()) {
  let g = read(db);
  // Önce biten üretim, ardından bekleyen günlerin maaşı işlenir.
  for (let cmd = due(g, now); cmd; cmd = due(g, now))
    g = apply(db, cmd, g.rev, now);
  return g;
}
