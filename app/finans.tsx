import { useAtolye } from "../src/session";
import { Card, Line, Page, cash } from "../src/ui";
import { profit, salesProfit } from "../src/workshop";
const names: Record<string, string> = {
  opening: "Açılış",
  buy: "Ham madde",
  assign: "Hatta atama",
  unassign: "Hattan çekme",
  hire: "Çalışan alındı · ilk gün maaşı",
  fire: "Çalışan ayrıldı",
  payroll: "Günlük maaş ödemesi",
  start: "Enerji ve paketleme",
  finish: "Mamul girişi",
  sell: "Net satış tahsilatı",
  upgrade: "Makine yatırımı",
};
export default function Finance() {
  const { g, log } = useAtolye();
  return (
    <Page title="Finans">
      <Card title="Kâr ve zarar">
        <Line label="Satış geliri" value={cash(g.income)} />
        <Line label="Satılan ürün maliyeti" value={cash(g.cogs)} />
        <Line label="Nakliye" value={cash(g.freight)} />
        <Line label="Oyun vergisi" value={cash(g.tax)} />
        <Line label="Sabit gider öncesi kazanç" value={cash(salesProfit(g))} />
        <Line label="İşçilik gideri" value={cash(g.wages)} />
        <Line label="Faaliyet kârı" value={cash(profit(g))} />
      </Card>
      <Card title="Nakit ve yatırım">
        <Line label="Kasa" value={cash(g.cash)} />
        <Line label="Makine yatırımları" value={cash(g.investment)} />
      </Card>
      <Card title="Son hareketler">
        {log.map((e) => (
          <Line
            key={e.revision}
            label={names[e.kind]}
            value={cash(e.movement)}
          />
        ))}
      </Card>
    </Page>
  );
}
