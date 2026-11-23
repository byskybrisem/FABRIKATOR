import React, { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAtolye } from "./session";
import { day } from "./workshop";
export const cash = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n / 100);
export const routes = [
  ["Fabrikam", "/fabrikam"],
  ["Üretim", "/uretim"],
  ["Depo", "/depo"],
  ["Piyasa", "/piyasa"],
  ["Siparişler", "/siparisler"],
  ["Finans", "/finans"],
  ["Banka", "/banka"],
] as const;
export function Page({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { g, now, error } = useAtolye();
  return (
    <SafeAreaView style={s.page}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.row}>
          {title === "Ana Panel" ? (
            <Text style={s.brand}>FABRİKATÖR</Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.dismissTo("/")}
            >
              <Text style={s.back}>‹ Ana Panel</Text>
            </Pressable>
          )}
          <Text style={s.tag}>GÜN {day(g, now)}</Text>
        </View>
        <Text accessibilityRole="header" style={s.h1}>
          {title}
        </Text>
        {error ? (
          <Text accessibilityRole="alert" style={{ color: "#973d33" }}>
            {error}
          </Text>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.h2}>
        {title}
      </Text>
      {children}
    </View>
  );
}
export function Line({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={s.line}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}
export function Action({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        disabled && s.disabled,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={s.btnLabel}>{label}</Text>
    </Pressable>
  );
}
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#faf9f4" },
  content: {
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
    padding: 20,
    gap: 14,
    paddingBottom: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  brand: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1.8,
    color: "#183d31",
  },
  tag: {
    color: "#375748",
    backgroundColor: "#e9eee3",
    borderRadius: 6,
    padding: 7,
    fontWeight: "700",
    fontSize: 12,
  },
  back: {
    color: "#225944",
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 10,
  },
  h1: {
    fontSize: 34,
    fontWeight: "800",
    color: "#183c31",
    letterSpacing: -1.3,
  },
  h2: { color: "#253e33", fontSize: 19, fontWeight: "700" },
  card: {
    gap: 12,
    backgroundColor: "#fffefa",
    borderRadius: 18,
    padding: 17,
    borderWidth: 1,
    borderColor: "#dce1d5",
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#dbe1d5",
    paddingVertical: 5,
  },
  label: { fontSize: 15, color: "#4a6053", flexShrink: 1 },
  value: {
    fontSize: 15,
    color: "#243d30",
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
    textAlign: "right",
  },
  btn: {
    backgroundColor: "#20583f",
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { backgroundColor: "#637467" },
  btnLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
  hero: { backgroundColor: "#e8ede0", borderRadius: 18, padding: 16, gap: 8 },
  big: { fontSize: 30, fontWeight: "800", color: "#254637" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  tile: {
    width: "48%",
    backgroundColor: "#fffefa",
    borderColor: "#d5ddcf",
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
    minHeight: 56,
  },
});
