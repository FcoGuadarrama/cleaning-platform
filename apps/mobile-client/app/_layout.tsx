import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useBrandFonts } from "../src/fonts";
import { InboxProvider, usePushTaps } from "../src/inbox";
import { stackScreenOptions } from "../src/navigation";
import { SessionProvider, useSession } from "../src/session";

/**
 * Role groups are protected routes: when the guard turns false (logout, expired session) the router drops them and
 * lands on the index, which sends the user to login. Navigation convenience only — the API enforces roles and ownership.
 */
function AppStack() {
  const { user, ready } = useSession();
  usePushTaps();
  // Waiting for the stored session keeps a deep link from being dropped (or firing requests) before the token loads.
  if (!ready) return null;
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Protected guard={user?.role === "customer"}>
        <Stack.Screen name="(customer)" />
      </Stack.Protected>
      <Stack.Protected guard={user?.role === "staff"}>
        <Stack.Screen name="(staff)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const fontsReady = useBrandFonts();
  if (!fontsReady) return null;
  return (
    <SessionProvider>
      <InboxProvider>
        <StatusBar style="dark" />
        {/* On wide web viewports the app keeps a phone-width column instead of stretching. */}
        <View className="flex-1 bg-surface web:items-center">
          <View className="w-full flex-1 bg-background web:max-w-[480px] web:border-x web:border-border">
            <AppStack />
          </View>
        </View>
      </InboxProvider>
    </SessionProvider>
  );
}
