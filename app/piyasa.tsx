import { useAtolye } from "../src/session";
import { Action, Card, Line, Page, cash } from "../src/ui";
import { DAY, market, r } from "../src/workshop";
export default function Market() {
  const { g, now, execute } = useAtolye(),
    q = market(g, now),
    n = Math.min(q.demand, g.chairs);
  const seconds = Math.ceil(
    (g.born + q.day * DAY - Math.max(now, g.last)) / 1000,
  );
  return (
    <Page title="Piyasa">
      <Card title="Toptancı teklifi">
        <Line label="Ahşap sandalye / adet" value={cash(q.price)} />
        <Line label="Bugünkü kalan talep" value={q.demand} />
        <Line
          label="Yeni teklife kalan"
          value={Math.floor(seconds / 60) + " dk " + (seconds % 60) + " sn"}
        />
        <Line label="Satılabilir stok" value={g.chairs} />
        <Line label="Nakliye / adet" value={cash(r.shippingPerUnit)} />
        <Line label="Satış vergisi" value="%5" />
        <Line
          label="Kasaya girecek net tutar"
          value={cash(
            n * q.price -
              Math.round(n * q.price * 0.05) -
              n * r.shippingPerUnit,
          )}
        />
        <Action
          disabled={n === 0}
          label={
            n
              ? n + " sandalyeyi sat"
              : g.chairs
                ? "Yeni günün teklifini bekle"
                : "Satılacak sandalye yok"
          }
          onPress={() => execute("sell", n)}
        />
      </Card>
    </Page>
  );
}
