import { Text } from "react-native";
import { useAtolye } from "../src/session";
import { Action, Card, Line, Page, cash, s } from "../src/ui";
import {
  available,
  catalog,
  counterPrice,
  customers,
  day,
  offerGain,
  MAX_ORDERS,
  PENALTY_PERCENT,
} from "../src/workshop";
export default function Orders() {
  const { g, now, execute } = useAtolye();
  const today = day(g, now);
  return (
    <Page title="Siparişler">
      <Card title="Müşteri ilişkileri">
        <Line label="İtibar" value={g.rep + " / 100"} />
        <Line label="Teslim edilen sipariş" value={g.delivered} />
        <Line
          label="Açık sipariş"
          value={g.orders.length + " / " + MAX_ORDERS}
        />
      </Card>
      {g.orders.map((o) => (
        <Card key={o.id} title={customers[o.customer].name}>
          <Line label="Ürün" value={o.qty + " " + catalog[o.product].name} />
          <Line label="Sözleşme bedeli" value={cash(o.price)} />
          <Line
            label="Son teslim"
            value={"Gün " + o.dueDay + (o.dueDay === today ? " (bugün)" : "")}
          />
          <Line
            label="Ayrılan / hazır"
            value={o.reserved + " / " + available(g, o.product)}
          />
          <Text style={s.label}>
            Teslim edilmezse bedelin %{PENALTY_PERCENT} ceza olarak ödenir ve
            itibar düşer.
          </Text>
          <Action
            label="Stoktan ayır"
            disabled={o.reserved >= o.qty || available(g, o.product) < 1}
            onPress={() => execute("reserve", { id: o.id })}
          />
          <Action
            label="Teslim et"
            disabled={o.reserved + available(g, o.product) < o.qty}
            onPress={() => execute("deliver", { id: o.id })}
          />
        </Card>
      ))}
      {g.offers.map((o) => (
        <Card key={o.id} title={"Teklif · " + customers[o.customer].name}>
          <Line label="Talep" value={o.qty + " " + catalog[o.product].name} />
          <Line label="Teklif" value={cash(o.price)} />
          <Line label="Nakliye" value={cash(o.shipping)} />
          <Line label="Teslim" value={"Gün " + o.dueDay + " sonuna kadar"} />
          <Line label="İtibar" value={"+" + o.rep} />
          <Line label="Tahmini net kazanç" value={cash(offerGain(g, o))} />
          <Action
            label="Kabul et"
            disabled={g.orders.length >= MAX_ORDERS}
            onPress={() => execute("accept", { id: o.id })}
          />
          <Action
            label={"Karşı teklif · " + cash(counterPrice(o))}
            disabled={g.orders.length >= MAX_ORDERS}
            onPress={() => execute("counter", { id: o.id })}
          />
          <Action
            label="Reddet"
            onPress={() => execute("decline", { id: o.id })}
          />
        </Card>
      ))}
      {!g.offers.length && (
        <Card title="Teklifler">
          <Text style={s.label}>
            Bugünün teklifleri yanıtlandı. Yeni teklifler yarın gelir.
          </Text>
        </Card>
      )}
    </Page>
  );
}
