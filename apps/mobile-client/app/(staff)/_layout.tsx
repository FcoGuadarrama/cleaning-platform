import { Stack } from "expo-router";
import { stackScreenOptions } from "../../src/navigation";

export default function StaffLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="job/[id]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="notification-settings" />
    </Stack>
  );
}
