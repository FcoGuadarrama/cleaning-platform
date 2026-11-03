import { Stack } from "expo-router";
import { RoleGate } from "../../src/RoleGate";

export default function StaffLayout() {
  return (
    <RoleGate role="staff">
      <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
        <Stack.Screen name="index" options={{ title: "Mis servicios" }} />
        <Stack.Screen name="earnings" options={{ title: "Ganancias de la semana" }} />
      </Stack>
    </RoleGate>
  );
}
