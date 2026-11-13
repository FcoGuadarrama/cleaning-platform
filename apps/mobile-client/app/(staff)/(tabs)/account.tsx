import { router } from "expo-router";
import { AccountScreen, AccountSection } from "../../../src/AccountScreen";
import { List, Row } from "../../../src/ui";

export default function StaffAccount() {
  return (
    <AccountScreen>
      <AccountSection title="Ayuda">
        <List>
          <Row icon="headset" title="Soporte e incidencias" soon />
          <Row icon="bell" title="Notificaciones" subtitle="Elige qué avisos recibir en tu teléfono" onPress={() => router.push("/(staff)/notification-settings")} />
        </List>
      </AccountSection>
    </AccountScreen>
  );
}
