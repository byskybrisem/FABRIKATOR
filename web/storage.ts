import {
  advance,
  day,
  due,
  initial,
  upgradeGame,
  validate,
  type Game,
  type Command,
} from "../src/workshop.ts";

export type Entry = {
  revision: number;
  kind: Command | "opening";
  movement: number;
};
/** Bump when the stored shape changes and add a step to `migrate`. */
export const SAVE_VERSION = 2;
export type Save = { version: number; game: Game; log: Entry[] };
type Input = {
  command: Exclude<Command, "finish" | "payroll">;
  revision: number;
  /** `game.born` of the save the player was looking at; rejects actions from before a reset. */
  born?: number;
  quantity?: number;
  quoteDay?: number;
};

/** The stored save cannot be trusted. It is never overwritten without the player's consent. */
export class CorruptSave extends Error {
  name = "CorruptSave";
}

const SLOT = 1;

export function openSave(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("fabrikator-web", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("workshop");
    req.onerror = () => reject(req.error);
    req.onblocked = () =>
      reject(
        new Error(
          "Oyun başka bir sekmede güncelleniyor. Sekmeyi kapatıp tekrar dene.",
        ),
      );
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

function migrate(raw: unknown): Save {
  if (typeof raw !== "object" || raw === null)
    throw new CorruptSave("Atölye kaydı okunamadı.");
  const save = raw as Partial<Save>;
  // Saves written before versioning had the same shape without the field.
  const version = save.version ?? 1;
  if (!Number.isSafeInteger(version) || version < 1)
    throw new CorruptSave("Atölye kaydının sürümü tanınmıyor.");
  if (version > SAVE_VERSION)
    throw new Error(
      "Bu kayıt oyunun daha yeni bir sürümüyle oluşturulmuş. Sayfayı yenileyip güncel sürümü aç.",
    );
  const { log } = save;
  if (typeof save.game !== "object" || save.game === null)
    throw new CorruptSave("Atölye kaydı eksik.");
  let game: Game;
  try {
    // v1 → v2: çalışan sistemi alanları eklenir; eski tek usta bordroda kalır.
    game = upgradeGame(save.game);
    validate(game);
  } catch (error) {
    throw new CorruptSave((error as Error).message);
  }
  if (!Array.isArray(log) || log[0]?.revision !== game.rev)
    throw new CorruptSave("Atölye hareketleri kayıtla eşleşmiyor.");
  return { version: SAVE_VERSION, game, log };
}

function fresh(now: number): Save {
  const game = initial(now);
  return {
    version: SAVE_VERSION,
    game,
    log: [{ revision: 0, kind: "opening", movement: game.cash }],
  };
}

// IndexedDB serializes overlapping readwrite transactions across windows.
// Only acknowledge an action after the balance, inventory and journal commit together.
export function transact(
  db: IDBDatabase,
  input?: Input,
  now = Date.now(),
): Promise<Save> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workshop", "readwrite");
    const store = tx.objectStore("workshop");
    const request = store.get(SLOT);
    let next: Save;
    let failure: unknown;
    tx.onabort = () =>
      reject(failure ?? tx.error ?? new Error("Kayıt tamamlanamadı."));
    tx.oncomplete = () => resolve(next);
    request.onsuccess = () => {
      try {
        const raw: unknown = request.result;
        const old = raw === undefined ? undefined : migrate(raw);
        const current = old ?? fresh(now);
        const game = current.game;
        if (input?.born !== undefined && input.born !== game.born)
          throw new Error(
            "Başka bir sekmede yeni oyun başlatıldı. Güncel atölyeyi kontrol et.",
          );
        if (input && game.rev !== input.revision)
          throw new Error(
            "Atölye güncellendi. İşlemi güncel stokla yeniden kontrol edin.",
          );
        if (input?.command === "sell" && input.quoteDay !== day(game, now))
          throw new Error("Yeni piyasa teklifi geldi. Fiyatı kontrol edin.");
        // Biten üretim ve yeni günün maaşı, oyuncunun işleminden önce ayrı satırlar olarak işlenir.
        let g = game;
        const entries: Entry[] = [];
        const run = (command: Command, quantity?: number) => {
          const updated = advance(g, command, now, quantity);
          entries.unshift({
            revision: updated.rev,
            kind: command,
            movement: updated.cash - g.cash,
          });
          g = updated;
        };
        for (let auto = due(g, now); auto; auto = due(g, now)) run(auto);
        if (input) run(input.command, input.quantity);
        next = entries.length
          ? {
              version: SAVE_VERSION,
              game: g,
              log: [...entries, ...current.log].slice(0, 12),
            }
          : current;
        if (
          !old ||
          entries.length ||
          (raw as Partial<Save>).version !== SAVE_VERSION
        )
          store.put(next, SLOT);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
  });
}

/**
 * Starts a new workshop. The previous record — readable or corrupt — is copied
 * under a backup key in the same transaction, so a reset never loses data silently.
 */
export function resetSave(db: IDBDatabase, now = Date.now()): Promise<Save> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workshop", "readwrite");
    const store = tx.objectStore("workshop");
    const next = fresh(now);
    const request = store.get(SLOT);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Yeni oyun başlatılamadı."));
    tx.oncomplete = () => resolve(next);
    request.onsuccess = () => {
      const raw: unknown = request.result;
      let pristine = false;
      try {
        pristine = raw !== undefined && migrate(raw).game.rev === 0;
      } catch {
        // Unreadable saves are always backed up.
      }
      // A unique key: two resets in the same millisecond must not replace the first backup.
      if (raw !== undefined && !pristine)
        store.add(
          raw,
          "yedek-" + now + "-" + Math.random().toString(36).slice(2, 10),
        );
      store.put(next, SLOT);
    };
  });
}
