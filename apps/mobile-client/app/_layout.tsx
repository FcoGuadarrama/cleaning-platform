import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useBrandFonts } from "../src/fonts";
import { stackScreenOptions } from "../src/navigation";
import { SessionProvider } from "../src/session";

export default function RootLayout() {
  const fontsReady = useBrandFonts();
  if (!fontsReady) return null;
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      {/* On wide web viewports the app keeps a phone-width column instead of stretching. */}
      <View className="flex-1 bg-surface web:items-center">
        <View className="w-full flex-1 bg-background web:max-w-[480px] web:border-x web:border-border">
          <Stack screenOptions={stackScreenOptions} />
        </View>
      </View>
    </SessionProvider>
  );
}
