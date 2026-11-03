import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "../src/session";

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Iniciar sesión" }} />
        <Stack.Screen name="register" options={{ title: "Crear cuenta" }} />
        <Stack.Screen name="(customer)" options={{ headerShown: false }} />
        <Stack.Screen name="(staff)" options={{ headerShown: false }} />
      </Stack>
    </SessionProvider>
  );
}
