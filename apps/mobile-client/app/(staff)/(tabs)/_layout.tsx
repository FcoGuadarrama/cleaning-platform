import { Tabs } from "expo-router";
import { tabIcon, useTabScreenOptions } from "../../../src/navigation";

export default function StaffTabs() {
  return (
    <Tabs screenOptions={useTabScreenOptions()}>
      <Tabs.Screen name="index" options={{ title: "Servicios", tabBarIcon: tabIcon("calendar") }} />
      <Tabs.Screen name="earnings" options={{ title: "Ganancias", tabBarIcon: tabIcon("wallet") }} />
      <Tabs.Screen name="account" options={{ title: "Cuenta", tabBarIcon: tabIcon("person") }} />
    </Tabs>
  );
}
