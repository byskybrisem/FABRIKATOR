// Para değerleri kuruştur. Bir üretim emri daima tek parti işler.
export const recipe = Object.freeze({
  chairs: 10, boards: 20, kits: 10, boardPrice: 4000, kitPrice: 2000,
  labor: 30000, unitSale: 18000, durationMs: 60000, startingCash: 200000
});
export const materials = recipe.boards * recipe.boardPrice + recipe.kits * recipe.kitPrice;
export const cost = materials + recipe.labor;
export const revenue = recipe.chairs * recipe.unitSale;

export type Command = 'buy' | 'start' | 'collect' | 'sell';
export type Game = {
  cash: number; boards: number; kits: number; chairs: number;
  ready_at: number | null; sold: number; profit: number; revision: number;
};

type DB = {
  execSync(sql: string): void;
  runSync(sql: string, ...args: number[]): { changes: number };
  getFirstSync<T>(sql: string): T | null;
};

export function openWorkshop(db: DB) {
  db.execSync(`CREATE TABLE IF NOT EXISTS workshop (
    id INTEGER PRIMARY KEY CHECK(id=1), cash INTEGER NOT NULL CHECK(cash>=0),
    boards INTEGER NOT NULL CHECK(boards>=0), kits INTEGER NOT NULL CHECK(kits>=0),
    chairs INTEGER NOT NULL CHECK(chairs>=0), ready_at INTEGER,
    sold INTEGER NOT NULL, profit INTEGER NOT NULL, revision INTEGER NOT NULL
  );
  INSERT INTO workshop VALUES(1,${recipe.startingCash},0,0,0,NULL,0,0,0)
    ON CONFLICT(id) DO NOTHING;`);
  return readGame(db);
}

export function readGame(db: DB): Game {
  const game = db.getFirstSync<Game>('SELECT cash,boards,kits,chairs,ready_at,sold,profit,revision FROM workshop WHERE id=1');
  if (!game) throw new Error('Atölye kaydı bulunamadı.');
  return game;
}

// Stok, zaman ve para tek SQL güncellemesiyle kaydedilir.
// Ekrandaki sürüm eskiyse aynı dokunuş ikinci kez işlenmez.
export function act(db: DB, command: Command, revision: number, now = Date.now()): Game {
  let changed: { changes: number };
  switch (command) {
    case 'buy':
      changed = db.runSync(`UPDATE workshop SET cash=cash-?,boards=boards+?,kits=kits+?,revision=revision+1
        WHERE id=1 AND revision=? AND cash>=? AND boards=0 AND kits=0 AND ready_at IS NULL AND chairs=0`,
        materials, recipe.boards, recipe.kits, revision, materials);
      break;
    case 'start':
      changed = db.runSync(`UPDATE workshop SET cash=cash-?,boards=boards-?,kits=kits-?,ready_at=?,revision=revision+1
        WHERE id=1 AND revision=? AND cash>=? AND boards>=? AND kits>=? AND ready_at IS NULL AND chairs=0`,
        recipe.labor, recipe.boards, recipe.kits, now + recipe.durationMs, revision, recipe.labor, recipe.boards, recipe.kits);
      break;
    case 'collect':
      changed = db.runSync(`UPDATE workshop SET chairs=chairs+?,ready_at=NULL,revision=revision+1
        WHERE id=1 AND revision=? AND ready_at<=?`, recipe.chairs, revision, now);
      break;
    case 'sell':
      changed = db.runSync(`UPDATE workshop SET chairs=chairs-?,cash=cash+?,sold=sold+?,profit=profit+?,revision=revision+1
        WHERE id=1 AND revision=? AND chairs>=?`, recipe.chairs, revenue, recipe.chairs, revenue-cost, revision, recipe.chairs);
      break;
    default: throw new Error('Geçersiz işlem.');
  }
  if (!changed.changes) throw new Error('İşlem yapılamadı. Güncel stok, bakiye ve üretim süresini kontrol edin.');
  return readGame(db);
}
export function stage(game: Game): Command {
  if (game.chairs >= recipe.chairs) return 'sell';
  if (game.ready_at !== null) return 'collect';
  return game.boards >= recipe.boards ? 'start' : 'buy';
}
