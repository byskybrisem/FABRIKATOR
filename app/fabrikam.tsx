import { Text } from "react-native";
import { useAtolye } from "../src/session";
import { Card, Page, Line, Action, cash, s } from "../src/ui";
import { duration, profit, upgradePrice } from "../src/workshop";
export default function FactoryScreen() {
  const { g, execute } = useAtolye(),
    p = upgradePrice(g);
  return (
    <Page title="Fabrikam">
      <Card title="Montaj ustası">
        <Line
          label="Görev"
          value={g.workers ? "Montaj hattı" : "Atama bekliyor"}
        />
        <Action
          label={g.workers ? "Ustayı hattan al" : "Ustayı hatta ata"}
          disabled={!!g.job}
          onPress={() => execute("assign")}
        />
      </Card>
      <Card title={"Montaj makinesi · Seviye " + g.level}>
        <Line label="Çevrim süresi" value={duration(g) / 1000 + " sn"} />
        <Line label="Çevrim kapasitesi" value={g.level * 10 + " sandalye"} />
        {g.level < 3 ? (
          <>
            <Line
              label="Yatırıma ayrılabilir kazanç"
              value={cash(Math.max(0, profit(g) - g.investment))}
            />
            <Text style={s.label}>
              Sonraki seviyede {10 * (g.level + 1)} sandalye{" "}
              {60 / (g.level + 1)} saniyede üretilir.
            </Text>
            <Action
              label={"Makineyi geliştir · " + cash(p)}
              disabled={!!g.job || profit(g) - g.investment < p || g.cash < p}
              onPress={() => execute("upgrade")}
            />
          </>
        ) : (
          <Text style={s.label}>En yüksek makine seviyesi.</Text>
        )}
      </Card>
    </Page>
  );
}
