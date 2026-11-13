import { AppTabs } from "../../../src/navigation";

export default function CustomerTabs() {
  return (
    <AppTabs
      tabs={[
        { name: "index", title: "Inicio", icon: "home" },
        { name: "plans", title: "Planes", icon: "layers" },
        { name: "bookings", title: "Visitas", icon: "calendar" },
        { name: "account", title: "Cuenta", icon: "person" },
      ]}
    />
  );
}
