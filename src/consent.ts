import { Alert } from "react-native";
import { cash } from "./ui";
import { loanProducts, loanQuote, type Arg, type Command } from "./workshop";

type Quote = ReturnType<typeof loanQuote>;
/**
 * Kredi açan her işlem (kredi kullanımı, makine finansmanı) bu onay penceresinden geçer:
 * oyuncu tutarı, faizi, toplam geri ödemeyi ve vadeyi görüp onaylamadan borç oluşmaz.
 * Onaylanan toplam motora iletilir; koşullar o arada değiştiyse işlem reddedilir.
 */
export function askLoan(
  q: Quote,
  execute: (cmd: Command, arg?: number | Arg) => void,
  cmd: "borrow" | "upgrade",
) {
  Alert.alert(
    loanProducts[q.kind].name,
    "Tutar: " +
      cash(q.amount) +
      "\nToplam faiz: " +
      cash(q.interest) +
      "\nToplam geri ödeme: " +
      cash(q.total) +
      "\nVade: " +
      q.days +
      " oyun günü\nÖdenemeyen taksit gecikme bedeli doğurur ve kredi notunu düşürür.",
    [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Onayla",
        onPress: () =>
          execute(
            cmd,
            cmd === "borrow"
              ? { loan: q.kind, qty: q.amount, quote: q.total }
              : { loan: q.kind, quote: q.total },
          ),
      },
    ],
  );
}
