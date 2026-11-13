import { router } from "expo-router";
import { AccountScreen, AccountSection } from "../../../src/AccountScreen";
import { useAddresses } from "../../../src/addresses";
import { api } from "../../../src/api";
import { subscriptionStatus } from "../../../src/subscriptions";
import { List, Row } from "../../../src/ui";
import { useResource } from "../../../src/useResource";
import { usualStaffId } from "../../../src/visits";

export default function CustomerAccount() {
  const bookings = useResource(() => api.GET("/bookings"));
  const staff = useResource(() => api.GET("/staff"));
  const usualId = usualStaffId(bookings.data ?? []);
  const usual = staff.data?.find((s) => s.id === usualId);
  const addresses = useAddresses();
  const saved = addresses.data ?? [];
  const main = saved.find((a) => a.is_default);
  const subscriptions = useResource(() => api.GET("/subscriptions"));
  const plan = subscriptions.data?.find((s) => s.status === "active") ?? subscriptions.data?.[0];

  return (
    <AccountScreen>
      <AccountSection title="Tu hogar">
        <List>
          <Row
            icon="home"
            title="Mis domicilios"
            subtitle={main ? `${main.label}${saved.length > 1 ? ` y ${saved.length - 1} más` : ""}` : "Guarda tu casa u oficina"}
            onPress={() => router.push("/(customer)/addresses")}
          />
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
          <Row
            icon="layers"
            title="Mi suscripción"
            subtitle={plan ? `${plan.plan_name} · ${subscriptionStatus(plan).label.toLowerCase()}` : "Aún no tienes un plan"}
            onPress={() => router.push("/(customer)/subscription")}
          />
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
