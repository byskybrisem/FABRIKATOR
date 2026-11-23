import { useAtolye } from "../src/session";
import { Action, Card, Line, Page, cash } from "../src/ui";
import {
  DAY,
  available,
  catalog,
  market,
  products,
  unlocked,
} from "../src/workshop";
export default function Market() {
  const { g, now, execute } = useAtolye();
  const seconds = Math.ceil(
    (g.born + market(g, now).day * DAY - Math.max(now, g.last)) / 1000,
  );
  return (
    <Page title="Piyasa">
      <Card title="Toptancı">
        <Line
          label="Yeni teklife kalan"
          value={Math.floor(seconds / 60) + " dk " + (seconds % 60) + " sn"}
        />
        <Line label="Satış vergisi" value="%5" />
      </Card>
      {products
        .filter((p) => unlocked(g, p))
        .map((p) => {
          const r = catalog[p],
            q = market(g, now, p),
            n = Math.min(q.demand, available(g, p));
          return (
            <Card key={p} title={r.name}>
              <Line label="Fiyat / adet" value={cash(q.price)} />
              <Line label="Bugünkü kalan talep" value={q.demand} />
              <Line label="Satılabilir stok" value={available(g, p)} />
              <Line label="Nakliye / adet" value={cash(r.shippingPerUnit)} />
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
                    ? n + " " + r.acc + " sat"
                    : "Satılabilir ürün veya talep yok"
                }
                onPress={() => execute("sell", { product: p, qty: n })}
              />
            </Card>
          );
        })}
    </Page>
  );
}
