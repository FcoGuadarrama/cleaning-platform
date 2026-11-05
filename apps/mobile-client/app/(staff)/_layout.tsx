import { Tabs } from "expo-router";
import { tabIcon, tabScreenOptions } from "../../src/navigation";
import { RoleGate } from "../../src/RoleGate";

export default function StaffLayout() {
  return (
    <RoleGate role="staff">
      <Tabs screenOptions={tabScreenOptions}>
        <Tabs.Screen name="index" options={{ title: "Servicios", tabBarIcon: tabIcon("calendar") }} />
        <Tabs.Screen name="earnings" options={{ title: "Ganancias", tabBarIcon: tabIcon("wallet") }} />
        <Tabs.Screen name="account" options={{ title: "Cuenta", tabBarIcon: tabIcon("person") }} />
      </Tabs>
    </RoleGate>
  );
}
