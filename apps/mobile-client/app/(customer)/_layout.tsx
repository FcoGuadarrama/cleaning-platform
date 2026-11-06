import { Stack } from "expo-router";
import { stackScreenOptions } from "../../src/navigation";
import { RoleGate } from "../../src/RoleGate";

export default function CustomerLayout() {
  return (
    <RoleGate role="customer">
      <Stack screenOptions={{ ...stackScreenOptions, headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="staff/[id]" />
        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="book" />
      </Stack>
    </RoleGate>
  );
}
