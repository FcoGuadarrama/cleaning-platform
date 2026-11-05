import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SessionProvider } from "../src/session";
import { stackScreenOptions } from "../src/navigation";

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      {/* On wide web viewports the app keeps a phone-width column instead of stretching. */}
      <View className="flex-1 bg-surface web:items-center">
        <View className="w-full flex-1 web:max-w-[480px] web:border-x web:border-border/60">
          <Stack screenOptions={stackScreenOptions}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen name="(customer)" options={{ headerShown: false }} />
            <Stack.Screen name="(staff)" options={{ headerShown: false }} />
          </Stack>
        </View>
      </View>
    </SessionProvider>
  );
}
