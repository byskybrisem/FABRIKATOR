import { useAtolye } from "../src/session";
import { Action, Card, Line, Page, cash } from "../src/ui";
import { r } from "../src/workshop";
export default function Stock() {
  const { g, execute } = useAtolye();
  return (
    <Page title="Depo">
      <Card title="Ham madde">
        <Line label="Tahta" value={g.lots * r.boards} />
        <Line label="Bağlantı seti" value={g.lots * r.kits} />
        <Line label="Stok maliyeti" value={cash(g.rawCost)} />
        <Action
          label={"20 tahta + 10 set al · " + cash(r.materials)}
          disabled={g.cash < r.materials}
          onPress={() => execute("buy")}
        />
      </Card>
      <Card title="Mamul deposu">
        <Line label="Ahşap sandalye" value={g.chairs} />
        <Line label="Depodaki mamul maliyeti" value={cash(g.goodsCost)} />
      </Card>
    </Page>
  );
}
