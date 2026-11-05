import { Tabs } from "expo-router";
import { tabIcon, useTabScreenOptions } from "../../src/navigation";
import { RoleGate } from "../../src/RoleGate";

export default function StaffLayout() {
  const options = useTabScreenOptions();
  return (
    <RoleGate role="staff">
      <Tabs screenOptions={options}>
        <Tabs.Screen name="index" options={{ title: "Servicios", tabBarIcon: tabIcon("calendar") }} />
        <Tabs.Screen name="earnings" options={{ title: "Ganancias", tabBarIcon: tabIcon("wallet") }} />
        <Tabs.Screen name="account" options={{ title: "Cuenta", tabBarIcon: tabIcon("person") }} />
      </Tabs>
    </RoleGate>
  );
}
