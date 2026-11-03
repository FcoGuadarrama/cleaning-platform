import { Stack } from "expo-router";
import { RoleGate } from "../../src/RoleGate";

export default function CustomerLayout() {
  return (
    <RoleGate role="customer">
      <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
        <Stack.Screen name="index" options={{ title: "Elige a tu persona de limpieza" }} />
        <Stack.Screen name="book" options={{ title: "Reservar visita" }} />
        <Stack.Screen name="bookings" options={{ title: "Mis reservas" }} />
      </Stack>
    </RoleGate>
  );
}
