import { Text } from "react-native";
import { askLoan } from "../src/consent";
import { useAtolye } from "../src/session";
import { Card, Page, Line, Action, cash, s } from "../src/ui";
import {
  cycle,
  loanQuote,
  profit,
  seats,
  upgradePrice,
  MAX_STAFF,
  WAGE,
} from "../src/workshop";
export default function FactoryScreen() {
  const { g, execute } = useAtolye(),
    p = upgradePrice(g),
    idle = g.staff - g.workers,
    n = seats(g.level);
  return (
    <Page title="Fabrikam">
      <Card title="Personel">
        <Text style={s.label}>
          Montaj çalışanları hattı işletir. Hattaki her çalışan çevrimi
          hızlandırır; her çalışan hatta olmasa da günlük {cash(WAGE)} maaş
          alır.
        </Text>
        <Line label="Toplam çalışan" value={g.staff + " / " + MAX_STAFF} />
        <Line label="Hatta" value={g.workers + " / " + n} />
        <Line label="Boşta" value={idle} />
        <Line label="Günlük maaş" value={cash(g.staff * WAGE)} />
        <Action
          label={"Montaj çalışanı al · " + cash(WAGE)}
          disabled={g.staff >= MAX_STAFF || g.cash < WAGE}
          onPress={() => execute("hire")}
        />
        <Action
          label="Hatta ata"
          disabled={!!g.job || !idle || g.workers >= n}
          onPress={() => execute("assign")}
        />
        <Action
          label="Hattan çek"
          disabled={!!g.job || !g.workers}
          onPress={() => execute("unassign")}
        />
        <Action
          label="Boştaki çalışanı çıkar"
          disabled={!idle}
          onPress={() => execute("fire")}
        />
      </Card>
      <Card title={"Montaj hattı · Seviye " + g.level}>
        <Line
          label="Tek parti süresi"
          value={g.workers ? cycle(g.level, 1, g.workers) / 1000 + " sn" : "—"}
        />
        <Line label="Çevrim kapasitesi" value={g.level * 10 + " sandalye"} />
        <Line label="Hat koltuğu" value={n} />
        {g.level < 3 ? (
          <>
            <Line
              label="Yatırıma ayrılabilir kazanç"
              value={cash(Math.max(0, profit(g) - g.investment))}
            />
            <Text style={s.label}>
              Sonraki seviyede çevrimde {10 * (g.level + 1)} sandalye ve hatta{" "}
              {seats(g.level + 1)} koltuk olur.
            </Text>
            <Action
              label={"Makineyi geliştir · " + cash(p)}
              disabled={!!g.job || profit(g) - g.investment < p || g.cash < p}
              onPress={() => execute("upgrade")}
            />
            <Action
              label={
                "Makine finansmanıyla geliştir · " +
                cash(loanQuote(g, "leasing", p).total)
              }
              disabled={!!g.job || !!loanQuote(g, "leasing", p).reason}
              onPress={() =>
                askLoan(loanQuote(g, "leasing", p), execute, "upgrade")
              }
            />
          </>
        ) : (
          <Text style={s.label}>En yüksek makine seviyesi.</Text>
        )}
      </Card>
    </Page>
  );
}
