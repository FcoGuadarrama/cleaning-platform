import { Tabs } from "expo-router";
import { tabIcon, useTabScreenOptions } from "../../../src/navigation";

export default function CustomerTabs() {
  return (
    <Tabs screenOptions={useTabScreenOptions()}>
      <Tabs.Screen name="index" options={{ title: "Inicio", tabBarIcon: tabIcon("home", true) }} />
      <Tabs.Screen name="plans" options={{ title: "Planes", tabBarIcon: tabIcon("layers") }} />
      <Tabs.Screen name="bookings" options={{ title: "Visitas", tabBarIcon: tabIcon("calendar") }} />
      <Tabs.Screen name="account" options={{ title: "Cuenta", tabBarIcon: tabIcon("person", true) }} />
    </Tabs>
  );
}
