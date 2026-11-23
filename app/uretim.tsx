import { useState } from "react";
import { Text } from "react-native";
import { useAtolye } from "../src/session";
import { Action, Card, Line, Page, cash, s } from "../src/ui";
import {
  catalog,
  cycle,
  lockReason,
  lotsOf,
  products,
  type ProductId,
} from "../src/workshop";
export default function Production() {
  const { g, now, execute } = useAtolye();
  const [product, setProduct] = useState<ProductId>("chair");
  const r = catalog[product],
    locked = lockReason(g, product);
  return (
    <Page title="Üretim">
      <Card title="Ürün">
        {products.map((p) => (
          <Action
            key={p}
            label={
              (p === product ? "● " : "") +
              catalog[p].name +
              (lockReason(g, p) ? " · " + lockReason(g, p) : "")
            }
            disabled={!!lockReason(g, p)}
            onPress={() => setProduct(p)}
          />
        ))}
      </Card>
      <Card title={r.name}>
        <Line
          label={r.batch + " adet için ham madde"}
          value={cash(r.materials)}
        />
        <Line
          label="Enerji / paketleme"
          value={cash(r.energy) + " / " + cash(r.packaging)}
        />
        <Line
          label="Birim maliyet"
          value={cash((r.materials + r.energy + r.packaging) / r.batch)}
        />
      </Card>
      <Card title={g.job ? "Hat çalışıyor" : "Üretim emri"}>
        {g.job ? (
          <>
            <Line
              label="Üretilen"
              value={g.job + " " + catalog[g.jobProduct || "chair"].name}
            />
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
                cycle(g.level, 1, g.workers, product) / 1000 +
                " sn"
              }
            />
            <Text style={s.label}>
              {locked
                ? locked
                : !lotsOf(g, product)
                  ? "Depodan bu ürün için malzeme satın alın."
                  : !g.workers
                    ? "Fabrikam ekranından hatta çalışan atayın."
                    : "Her parti için hatta en az bir çalışan gerekir."}
            </Text>
            {Array.from({ length: g.level }, (_, i) => i + 1).map((n) => (
              <Action
                key={n}
                label={
                  n * r.batch +
                  " " +
                  r.name.toLowerCase() +
                  " üret · " +
                  cash(n * (r.energy + r.packaging))
                }
                disabled={
                  !!locked ||
                  g.workers < n ||
                  lotsOf(g, product) < n ||
                  g.cash < n * (r.energy + r.packaging)
                }
                onPress={() => execute("start", { product, qty: n })}
              />
            ))}
          </>
        )}
      </Card>
    </Page>
  );
}
