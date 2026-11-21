import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState, Text, View, Button } from "react-native";
import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import { openWorkshop, apply, resume, type Entry } from "./store";
import { day, type Command, type Game } from "./workshop";
type Session = {
  g: Game;
  now: number;
  execute: (cmd: Command, qty?: number) => void;
  log: Entry[];
  error: string;
};
const Context = createContext<Session | null>(null);
export function useAtolye() {
  const s = useContext(Context);
  if (!s) throw new Error("Atölye açılmadı.");
  return s;
}
export function SessionProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SQLiteDatabase | null>(null),
    [g, setG] = useState<Game | null>(null);
  const [log, setLog] = useState<Entry[]>([]),
    [now, setNow] = useState(Date.now);
  const [fatal, setFatal] = useState(false),
    [retry, setRetry] = useState(0),
    [error, setError] = useState("");
  function show(h: SQLiteDatabase, game: Game) {
    setLog(
      h.getAllSync<Entry>(
        "SELECT * FROM factory_log ORDER BY revision DESC LIMIT 12",
      ),
    );
    setG(game);
  }
  useEffect(() => {
    let h: SQLiteDatabase | undefined;
    try {
      h = openDatabaseSync("fabrikator.db");
      show(h, openWorkshop(h));
      setDb(h);
      setFatal(false);
      setError("");
    } catch {
      setFatal(true);
    }
    return () => h?.closeSync();
  }, [retry]);
  useEffect(() => {
    if (!db || !g || fatal) return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (g.ready && time >= g.ready) {
        try {
          show(db, resume(db, time));
        } catch {
          setFatal(true);
        }
      }
    };
    const timer = setInterval(tick, g.job ? 500 : 2000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [db, g, fatal]);
  if (fatal || !db || !g)
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 28 }}>
        <Text>
          {fatal
            ? "Atölye kaydı okunamadı. Tekrar açmayı deneyin."
            : "Atölye açılıyor…"}
        </Text>
        {fatal && (
          <Button title="Tekrar dene" onPress={() => setRetry((v) => v + 1)} />
        )}
      </View>
    );
  function execute(cmd: Command, qty = 1) {
    if (!db || !g) return;
    try {
      const time = Date.now();
      if (cmd === "sell" && day(g, time) !== day(g, now)) {
        setNow(time);
        throw new Error(
          "Yeni gün başladı. Güncel toptancı teklifini kontrol edin.",
        );
      }
      show(db, apply(db, cmd, g.rev, time, qty));
      setNow(time);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem kaydedilemedi.");
      try {
        show(db, resume(db));
      } catch {
        setFatal(true);
      }
    }
  }
  return (
    <Context.Provider value={{ g, now, log, execute, error }}>
      {children}
    </Context.Provider>
  );
}
