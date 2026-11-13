import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
import { api } from "../../../src/api";
import { BOOKING_LABELS, BOOKING_TONES, formatClock, formatRelativeDay, sentenceCase } from "../../../src/format";
import { Skeleton } from "../../../src/motion";
import { PaymentDue } from "../../../src/PaymentDue";
import { FlowScreen } from "../../../src/screen";
import { Text } from "../../../src/text";
import { Avatar, Button, Callout, Hairline, InfoNote, List, Notice, Row, SectionTitle, SkeletonRows, Soon, StatusChip } from "../../../src/ui";
import { useResource } from "../../../src/useResource";
import { isPlanVisit, UPCOMING, visitPrice, visitTitle } from "../../../src/visits";

const SIDE_STATES: Record<string, string> = {
  cancelled: "Esta visita se canceló.",
  expired: "El horario se liberó porque el pago no se completó a tiempo.",
  disputed: "Administración está revisando esta visita.",
  pending_review: "Administración está revisando el registro de esta visita.",
};

export default function VisitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useResource(() => api.GET("/bookings/{booking_id}", { params: { path: { booking_id: Number(id) } } }), [id]);
  const staff = useResource(() => api.GET("/staff"));
  const offerings = useResource(() => api.GET("/offerings"));
  const b = booking.data;
  const person = b ? staff.data?.find((s) => s.id === b.staff_id) : undefined;
  const offering = b ? offerings.data?.find((o) => o.id === b.offering_id) : undefined;
  const upcoming = !!b && UPCOMING.has(b.status);
  // A one-off visit awaiting payment is a payment screen until it is paid; plan visits are paid with their cycle.
  const awaitingPayment = !!b && b.status === "held" && !isPlanVisit(b);

  return (
    <FlowScreen title={awaitingPayment ? "Pago pendiente" : "Detalle de visita"} fallback="/(customer)/(tabs)/bookings">
      {booking.error ? <Notice tone="danger" text={booking.error} /> : null}
      {!b && !booking.error ? (
        <View className="gap-3">
          <Skeleton className="h-7 w-28 rounded-md" />
          <Skeleton className="h-10 w-48" />
          <SkeletonRows count={3} />
        </View>
      ) : null}
      {b && awaitingPayment ? (
        <PaymentDue booking={b} staffName={person?.display_name} serviceName={offering?.name} onChange={() => void booking.refresh()} />
      ) : null}
      {b && !awaitingPayment ? (
        <>
          <View className="gap-2">
            <StatusChip label={BOOKING_LABELS[b.status]} tone={BOOKING_TONES[b.status]} />
            <Text accessibilityRole="header" className="text-[34px] font-semibold leading-[42px] tracking-[-1px] text-text">
              {sentenceCase(formatRelativeDay(b.starts_at))}, {formatClock(b.starts_at)}
            </Text>
            <Text className="text-md text-text">
              {visitTitle(b, offering) ? `${visitTitle(b, offering)} · ` : ""}Hasta las {formatClock(b.ends_at)}
            </Text>
          </View>

          <View className="gap-4">
            <View className="flex-row items-center gap-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={person ? `Ver perfil de ${person.display_name}` : undefined}
                disabled={!person}
                onPress={() => person && router.push({ pathname: "/(customer)/staff/[id]", params: { id: String(person.id) } })}
                className="flex-1 flex-row items-center gap-4 active:opacity-70"
              >
                <Avatar name={person?.display_name ?? "?"} size="md" />
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-text">{person?.display_name ?? "Personal asignado"}</Text>
                  <Text className="text-sm text-text">Tu profesional de limpieza</Text>
                </View>
              </Pressable>
              <Button label="Mensaje" icon="message" variant="outlinePrimary" compact soon />
            </View>
            <Hairline />
          </View>

          {SIDE_STATES[b.status] ? <Notice tone="neutral" text={SIDE_STATES[b.status]!} /> : null}

          <View className="gap-2">
            <SectionTitle title="Tu casa, a tu manera" />
            <View className="flex-row items-center gap-3">
              <Text className="flex-1 text-md text-text-muted">Lista de tareas de la visita</Text>
              <Soon />
            </View>
          </View>

          <View className="gap-1">
            <SectionTitle title="Indicaciones para esta visita" />
            <List>
              <Row icon="paw" title="Mascotas" soon />
              <Row icon="flag" title="Prioridad" soon />
            </List>
          </View>

          {upcoming ? (
            <Callout icon="spray">
              <Text className="text-md font-semibold text-text">Prepara tu visita</Text>
              <Text className="text-sm text-text">Ten a mano los productos y facilita el acceso.</Text>
            </Callout>
          ) : null}

          <List>
            <Row icon="pin" title="Domicilio" subtitle={b.address} />
            {isPlanVisit(b) ? (
              <Row icon="layers" title="Plan mensual" value="Incluida" onPress={() => router.push("/(customer)/subscription")} />
            ) : (
              <Row icon="card" title="Total" value={visitPrice(b)} />
            )}
            {upcoming ? <Row icon="calendar" title="Cambiar fecha" soon /> : null}
            {upcoming ? <Row icon="person" title="Solicitar reemplazo" soon /> : null}
          </List>

          {upcoming ? <InfoNote text="Cambios con al menos 24 h de anticipación." /> : null}

          <Button label="Ayuda con mi visita" icon="headset" variant="outlinePrimary" soon />
        </>
      ) : null}
    </FlowScreen>
  );
}
