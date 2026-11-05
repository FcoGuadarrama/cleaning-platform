import { Tabs } from "expo-router";
import { tabIcon, tabScreenOptions } from "../../../src/navigation";

export default function CustomerTabs() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: "Personal", tabBarIcon: tabIcon("people") }} />
      <Tabs.Screen name="bookings" options={{ title: "Reservas", tabBarIcon: tabIcon("calendar") }} />
      <Tabs.Screen name="account" options={{ title: "Cuenta", tabBarIcon: tabIcon("person") }} />
    </Tabs>
  );
}
