import {
  advance,
  day,
  initial,
  validate,
  type Game,
  type Command,
} from "../src/workshop.ts";

export type Entry = {
  revision: number;
  kind: Command | "opening";
  movement: number;
};
export type Save = { game: Game; log: Entry[] };
type Input = {
  command: Exclude<Command, "finish">;
  revision: number;
  quantity?: number;
  quoteDay?: number;
};

export function openSave(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("fabrikator-web", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("workshop");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
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
    const request = store.get(1);
    let next: Save;
    let failure: unknown;
    tx.onabort = () =>
      reject(failure ?? tx.error ?? new Error("Kayıt tamamlanamadı."));
    tx.oncomplete = () => resolve(next);
    request.onsuccess = () => {
      try {
        const old: Save | undefined = request.result;
        const game = old === undefined ? initial(now) : old.game;
        validate(game);
        const log =
          old === undefined
            ? [{ revision: 0, kind: "opening" as const, movement: game.cash }]
            : old.log;
        if (!Array.isArray(log) || log[0]?.revision !== game.rev)
          throw new Error("Atölye hareketleri kayıtla eşleşmiyor.");
        if (input && game.rev !== input.revision)
          throw new Error(
            "Atölye güncellendi. İşlemi güncel stokla yeniden kontrol edin.",
          );
        if (input?.command === "sell" && input.quoteDay !== day(game, now))
          throw new Error("Yeni piyasa teklifi geldi. Fiyatı kontrol edin.");
        const command =
          input?.command ??
          (game.ready && now >= game.ready ? "finish" : undefined);
        if (command) {
          const updated = advance(game, command, now, input?.quantity);
          const entry: Entry = {
            revision: updated.rev,
            kind: command,
            movement: updated.cash - game.cash,
          };
          next = { game: updated, log: [entry, ...log.slice(0, 11)] };
        } else next = { game, log };
        if (!old || command) store.put(next, 1);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
  });
}
