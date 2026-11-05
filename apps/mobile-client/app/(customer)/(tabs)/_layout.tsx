import { Tabs } from "expo-router";
import { tabIcon, useTabScreenOptions } from "../../../src/navigation";

export default function CustomerTabs() {
  return (
    <Tabs screenOptions={useTabScreenOptions()}>
      <Tabs.Screen name="index" options={{ title: "Inicio", tabBarIcon: tabIcon("home") }} />
      <Tabs.Screen name="bookings" options={{ title: "Reservas", tabBarIcon: tabIcon("calendar") }} />
      <Tabs.Screen name="account" options={{ title: "Cuenta", tabBarIcon: tabIcon("person") }} />
    </Tabs>
  );
}
