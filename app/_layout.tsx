import { Stack } from "expo-router";
import { SessionProvider } from "../src/session";
export default function Layout() {
  return (
    <SessionProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#faf9f5" },
        }}
      />
    </SessionProvider>
  );
}
