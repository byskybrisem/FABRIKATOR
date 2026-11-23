import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Factory } from "../src/Factory";
import { useAtolye } from "../src/session";
import { Action, cash, Line, Page, routes, s } from "../src/ui";
export default function Dashboard() {
  const { g, now } = useAtolye();
  const next = g.job
    ? routes[1]
    : g.chairs
      ? routes[3]
      : !g.lots
        ? routes[2]
        : !g.workers
          ? routes[0]
          : routes[1];
  return (
    <Page title="Ana Panel">
      <View style={s.hero}>
        <Text style={s.h2}>Mobilya atölyesi</Text>
        <Factory
          stage={
            g.job ? "collect" : g.chairs ? "sell" : g.lots ? "start" : "buy"
          }
          pulse={Math.floor(now / 500)}
        />
        <Line label="Kasa" value={cash(g.cash)} />
        <Line
          label="Personel"
          value={g.workers + " hatta · " + (g.staff - g.workers) + " boşta"}
        />
        <Line
          label="Montaj hattı"
          value={g.job ? g.job + " sandalye üretimde" : "Boş"}
        />
        <Action
          label={
            g.job
              ? "Üretimi izle"
              : g.chairs
                ? "Toptancı teklifine git"
                : !g.lots
                  ? "Ham madde satın al"
                  : !g.workers
                    ? "Çalışanı hatta ata"
                    : "Üretim emri ver"
          }
          onPress={() => router.push(next[1])}
        />
      </View>
      <View style={s.grid}>
        {routes.map(([name, path]) => (
          <Pressable
            key={path}
            accessibilityRole="button"
            style={s.tile}
            onPress={() => router.push(path)}
          >
            <Text style={s.h2}>{name}</Text>
          </Pressable>
        ))}
      </View>
    </Page>
  );
}
