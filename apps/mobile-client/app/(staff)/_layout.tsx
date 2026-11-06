import { Stack } from "expo-router";
import { stackScreenOptions } from "../../src/navigation";
import { RoleGate } from "../../src/RoleGate";

export default function StaffLayout() {
  return (
    <RoleGate role="staff">
      <Stack screenOptions={{ ...stackScreenOptions, headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="job/[id]" />
      </Stack>
    </RoleGate>
  );
}
