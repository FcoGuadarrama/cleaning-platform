import { AppTabs } from "../../../src/navigation";

export default function StaffTabs() {
  return (
    <AppTabs
      tabs={[
        { name: "index", title: "Servicios", icon: "calendar" },
        { name: "earnings", title: "Ganancias", icon: "card" },
        { name: "account", title: "Cuenta", icon: "person" },
      ]}
    />
  );
}
