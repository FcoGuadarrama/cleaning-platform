import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { api } from "../../../src/api";
import { FlowHeader } from "../../../src/FlowHeader";
import { BOOKING_LABELS, BOOKING_TONES, formatDuration, formatLongDay, formatMoney, formatTime, sentenceCase } from "../../../src/format";
import { Icon, type IconName } from "../../../src/icons";
import { Rise, Skeleton } from "../../../src/motion";
import { onTimeline, StatusTimeline } from "../../../src/StatusTimeline";
import { color } from "../../../src/theme";
import { Avatar, Badge, Card, IconTile, Notice, SkeletonCards, toneFor } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

const SIDE_STATES: Record<string, string> = {
  cancelled: "Esta visita se canceló.",
  expired: "El horario se liberó porque el pago no se completó a tiempo.",
  disputed: "Administración está revisando esta visita.",
};

function Detail({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <IconTile icon={icon} size={40} />
      <View className="flex-1">
        <Text className="text-xs font-semibold text-text-muted">{label}</Text>
        <Text className="text-md font-medium text-text">{value}</Text>
      </View>
    </View>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="mt-0.5 h-6 w-6 items-center justify-center rounded-full bg-accent-soft">
        <Icon name="check" size={13} color={color.text} strokeWidth={3} />
      </View>
      <Text className="flex-1 text-md text-text">{text}</Text>
    </View>
  );
}

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useResource(() => api.GET("/bookings/{booking_id}", { params: { path: { booking_id: Number(id) } } }), [id]);
  const staff = useResource(() => api.GET("/staff"));
  const offerings = useResource(() => api.GET("/offerings"));
  const b = booking.data;
  const person = b ? staff.data?.find((s) => s.id === b.staff_id) : undefined;
  const offering = b ? offerings.data?.find((o) => o.id === b.offering_id) : undefined;
  const upcoming = b && (b.status === "held" || b.status === "confirmed");

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="pb-12">
      <FlowHeader fallback="/(customer)/(tabs)/bookings">
        {b ? (
          <View className="gap-2">
            <View className="self-start rounded-full bg-surface-raised px-3 py-1">
              <Text className="text-xs font-bold text-primary">{BOOKING_LABELS[b.status]}</Text>
            </View>
            <Text accessibilityRole="header" className="text-2xl font-extrabold tracking-[-0.8px] text-on-primary">{sentenceCase(formatLongDay(b.starts_at))}</Text>
            <Text className="text-md text-on-primary opacity-85">{formatTime(b.starts_at)} a {formatTime(b.ends_at)}</Text>
          </View>
        ) : (
          <View className="gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-8 w-56" />
          </View>
        )}
      </FlowHeader>

      <View className="-mt-8 gap-4 px-4">
        {booking.error ? <Notice tone="danger" text={booking.error} /> : null}
        {!b && !booking.error ? <SkeletonCards count={3} /> : null}
        {b ? (
          <>
            <Rise>
              <Card onPress={person ? () => router.push({ pathname: "/(customer)/staff/[id]", params: { id: String(person.id) } }) : undefined} accessibilityLabel={person ? `Ver perfil de ${person.display_name}` : undefined}>
                <View className="flex-row items-center gap-3">
                  <Avatar name={person?.display_name ?? "?"} tone={toneFor(b.staff_id)} />
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-text-muted">Te visita</Text>
                    <Text className="text-lg font-bold text-text">{person?.display_name ?? "Personal asignado"}</Text>
                  </View>
                  {person ? <Icon name="chevron" size={20} color={color["text-muted"]} /> : null}
                </View>
              </Card>
            </Rise>

            <Rise index={1}>
              <Card className="gap-4">
                <View className="flex-row items-center justify-between">
                  <Text accessibilityRole="header" className="text-lg font-bold text-text">Estado</Text>
                  <Badge label={BOOKING_LABELS[b.status]} tone={BOOKING_TONES[b.status]} />
                </View>
                {onTimeline(b.status) ? (
                  <StatusTimeline
                    status={b.status}
                    notes={{
                      Reservada: b.hold_expires_at ? `Horario apartado hasta las ${formatTime(b.hold_expires_at)}` : "Horario apartado",
                      Confirmada: "Pago recibido",
                      "En curso": `${person?.display_name ?? "Tu persona de limpieza"} registró su llegada`,
                      Completada: "Servicio terminado",
                    }}
                  />
                ) : (
                  <Notice tone="neutral" text={SIDE_STATES[b.status] ?? BOOKING_LABELS[b.status]} />
                )}
              </Card>
            </Rise>

            <Rise index={2}>
              <Card className="gap-4">
                <Text accessibilityRole="header" className="text-lg font-bold text-text">Detalles</Text>
                {offering ? <Detail icon="sparkle" label="Servicio" value={`${offering.name}, ${formatDuration(offering.duration_minutes)}`} /> : null}
                <Detail icon="pin" label="Dirección" value={b.address} />
                <Detail icon="wallet" label="Total" value={formatMoney(b.price_minor, b.currency)} />
              </Card>
            </Rise>

            {upcoming ? (
              <Rise index={3}>
                <Card className="gap-3">
                  <Text accessibilityRole="header" className="text-lg font-bold text-text">Antes de tu visita</Text>
                  <Tip text="Ten listos tus productos y utensilios de limpieza; la visita no los incluye." />
                  <Tip text="Asegúrate de que alguien pueda abrir a la hora acordada." />
                </Card>
              </Rise>
            ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}
