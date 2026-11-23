import { useAtolye } from "../src/session";
import { Action, Card, Line, Page, cash } from "../src/ui";
import {
  available,
  catalog,
  lotsOf,
  products,
  unlocked,
  SALVAGE_PERCENT,
} from "../src/workshop";
export default function Stock() {
  const { g, execute } = useAtolye();
  const open = products.filter((p) => unlocked(g, p));
  return (
    <Page title="Depo">
      <Card title="Ham madde">
        <Line label="Tahta" value={g.materials.board.qty} />
        <Line label="Bağlantı seti" value={g.materials.kit.qty} />
        <Line
          label="Stok maliyeti"
          value={cash(g.materials.board.cost + g.materials.kit.cost)}
        />
        {open.map((p) => (
          <Action
            key={p}
            label={
              catalog[p].name + " partisi al · " + cash(catalog[p].materials)
            }
            disabled={g.cash < catalog[p].materials}
            onPress={() => execute("buy", { product: p })}
          />
        ))}
        <Action
          label={
            "Bir sandalye partisi malzemesini elden çıkar · %" + SALVAGE_PERCENT
          }
          disabled={lotsOf(g, "chair") < 1}
          onPress={() => execute("salvage", { product: "chair" })}
        />
      </Card>
      <Card title="Mamul deposu">
        {products.map((p) => (
          <Line
            key={p}
            label={catalog[p].name}
            value={
              g.goods[p].qty +
              " adet · " +
              available(g, p) +
              " satılabilir · " +
              cash(g.goods[p].cost)
            }
          />
        ))}
      </Card>
    </Page>
  );
}
