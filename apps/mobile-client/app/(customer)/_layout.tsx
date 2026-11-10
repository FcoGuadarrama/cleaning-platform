import { Stack } from "expo-router";
import { stackScreenOptions } from "../../src/navigation";

export default function CustomerLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="staff/[id]" />
      <Stack.Screen name="booking/[id]" />
      <Stack.Screen name="book" />
      <Stack.Screen name="addresses/index" />
      <Stack.Screen name="addresses/[id]" />
      <Stack.Screen name="plans/index" />
      <Stack.Screen name="plans/[id]" />
    </Stack>
  );
}
