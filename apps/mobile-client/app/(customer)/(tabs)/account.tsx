import { router } from "expo-router";
import { AccountScreen, AccountSection } from "../../../src/AccountScreen";
import { api } from "../../../src/api";
import { List, Row } from "../../../src/ui";
import { useResource } from "../../../src/useResource";
import { usualStaffId } from "../../../src/visits";

export default function CustomerAccount() {
  const bookings = useResource(() => api.GET("/bookings"));
  const staff = useResource(() => api.GET("/staff"));
  const usualId = usualStaffId(bookings.data ?? []);
  const usual = staff.data?.find((s) => s.id === usualId);

  return (
    <AccountScreen>
      <AccountSection title="Tu hogar">
        <List>
          <Row icon="home" title="Mis domicilios" soon />
          <Row icon="sliders" title="Preferencias de limpieza" subtitle="Mascotas, superficies y prioridades" soon />
          <Row
            icon="person"
            title="Mi profesional habitual"
            subtitle={usual?.display_name ?? "Aparecerá después de tu primera visita"}
            onPress={usual ? () => router.push({ pathname: "/(customer)/staff/[id]", params: { id: String(usual.id) } }) : undefined}
          />
        </List>
      </AccountSection>
      <AccountSection title="Pagos y plan">
        <List>
          <Row icon="layers" title="Mi suscripción" subtitle="Plan mensual" soon />
          <Row icon="card" title="Métodos de pago" soon />
          <Row icon="receipt" title="Recibos y facturas" soon />
        </List>
      </AccountSection>
      <AccountSection title="Ayuda">
        <List>
          <Row icon="headset" title="Soporte e incidencias" soon />
          <Row icon="bell" title="Notificaciones y privacidad" soon />
        </List>
      </AccountSection>
    </AccountScreen>
  );
}
