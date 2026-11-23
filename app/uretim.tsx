import { Text } from "react-native";
import { useAtolye } from "../src/session";
import { Action, Card, Line, Page, cash, s } from "../src/ui";
import { cycle, r } from "../src/workshop";
export default function Production() {
  const { g, now, execute } = useAtolye();
  return (
    <Page title="Üretim">
      <Card title="Ahşap sandalye">
        <Line label="10 adet için ham madde" value={cash(r.materials)} />
        <Line
          label="Enerji / paketleme"
          value={cash(r.energy) + " / " + cash(r.packaging)}
        />
        <Line
          label="Birim maliyet"
          value={cash((r.materials + r.energy + r.packaging) / 10)}
        />
      </Card>
      <Card title={g.job ? "Hat çalışıyor" : "Üretim emri"}>
        {g.job ? (
          <>
            <Line label="Üretilen miktar" value={g.job} />
            <Line
              label="Depoya giriş"
              value={
                Math.max(0, Math.ceil((g.ready - now) / 1000)) + " sn sonra"
              }
            />
          </>
        ) : (
          <>
            <Line
              label="Hattaki çalışan"
              value={
                g.workers +
                " · tek parti " +
                cycle(g.level, 1, g.workers) / 1000 +
                " sn"
              }
            />
            <Text style={s.label}>
              {!g.lots
                ? "Depodan bir parti ham madde satın alın."
                : !g.workers
                  ? "Fabrikam ekranından hatta çalışan atayın."
                  : "Her parti için hatta en az bir çalışan gerekir."}
            </Text>
            {Array.from({ length: g.level }, (_, i) => i + 1).map((n) => (
              <Action
                key={n}
                label={
                  n * 10 +
                  " sandalye üret · " +
                  cash(n * (r.energy + r.packaging))
                }
                disabled={
                  g.workers < n ||
                  g.lots < n ||
                  g.cash < n * (r.energy + r.packaging)
                }
                onPress={() => execute("start", n)}
              />
            ))}
          </>
        )}
      </Card>
    </Page>
  );
}
