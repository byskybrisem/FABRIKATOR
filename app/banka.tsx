import { Alert, Text } from "react-native";
import { useAtolye } from "../src/session";
import { Action, Card, Line, Page, cash, s } from "../src/ui";
import {
  credit,
  creditLimit,
  debt,
  loanProducts,
  loanQuote,
  nextInstallment,
  type LoanKind,
} from "../src/workshop";
export default function Bank() {
  const { g, execute } = useAtolye();
  const c = credit(g),
    limit = creditLimit(g);
  function borrow(kind: LoanKind, amount: number) {
    const q = loanQuote(g, kind, amount);
    Alert.alert(
      loanProducts[kind].name,
      "Tutar: " +
        cash(q.amount) +
        "\nToplam faiz: " +
        cash(q.interest) +
        "\nToplam geri ödeme: " +
        cash(q.total) +
        "\nVade: " +
        q.days +
        " oyun günü",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Onayla",
          onPress: () =>
            execute("borrow", { loan: kind, qty: amount, quote: q.total }),
        },
      ],
    );
  }
  return (
    <Page title="Banka">
      <Card title="Hesaplar">
        <Line label="Kasa" value={cash(g.cash)} />
        <Line label="Banka hesabı" value={cash(g.bank)} />
        <Line label="Kredi borcu" value={cash(debt(g))} />
        <Line label="Kullanılabilir limit" value={cash(limit)} />
        <Line label="Kredi notu" value={c.score + " / 1000"} />
        <Action
          label="Kasadan 10.000 TL yatır"
          disabled={g.cash < 1000000}
          onPress={() => execute("deposit", 1000000)}
        />
        <Action
          label="Bankadan 10.000 TL çek"
          disabled={g.bank < 1000000}
          onPress={() => execute("withdraw", 1000000)}
        />
      </Card>
      {g.loans.map((l) => (
        <Card key={l.id} title={loanProducts[l.kind].name}>
          <Line label="Kalan anapara" value={cash(l.balance)} />
          <Line label="Sonraki taksit" value={cash(nextInstallment(l).total)} />
          <Line label="Kalan taksit" value={l.left} />
          {l.missed > 0 && (
            <Text style={s.label}>{l.missed} taksit gecikti.</Text>
          )}
          <Action
            label={"Tamamını erken öde · " + cash(l.balance)}
            disabled={g.cash + g.bank < l.balance}
            onPress={() => execute("repay", { id: l.id, qty: l.balance })}
          />
        </Card>
      ))}
      <Card title="Kredi teklifleri">
        {(["isletme", "buyume"] as LoanKind[]).map((kind) => {
          const q = loanQuote(g, kind, limit);
          return (
            <Action
              key={kind}
              label={loanProducts[kind].name + " · " + cash(limit)}
              disabled={!!q.reason}
              onPress={() => borrow(kind, limit)}
            />
          );
        })}
        <Text style={s.label}>
          Kurgusal oyun bankası; gerçek bankacılık hizmeti değildir.
        </Text>
      </Card>
      <Card title="Kredi notu">
        {c.parts.map(([label, pts]) => (
          <Line key={label} label={label} value={pts} />
        ))}
      </Card>
    </Page>
  );
}
