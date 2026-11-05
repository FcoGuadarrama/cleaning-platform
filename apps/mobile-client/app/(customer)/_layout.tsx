import { Stack } from "expo-router";
import { stackScreenOptions } from "../../src/navigation";
import { RoleGate } from "../../src/RoleGate";

export default function CustomerLayout() {
  return (
    <RoleGate role="customer">
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="book" options={{ headerShown: false }} />
      </Stack>
    </RoleGate>
  );
}
