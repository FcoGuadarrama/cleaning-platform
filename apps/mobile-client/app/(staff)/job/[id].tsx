import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../src/api";
import { attendLabel, canAttend, openDirections, useAttendance } from "../../../src/attendance";
import { FlowHeader } from "../../../src/FlowHeader";
import { BOOKING_LABELS, BOOKING_TONES, formatDuration, formatLongDay, formatTime, sentenceCase } from "../../../src/format";
import { Rise, Skeleton } from "../../../src/motion";
import { onTimeline, StatusTimeline } from "../../../src/StatusTimeline";
import { shadow } from "../../../src/theme";
import { Badge, Button, Card, IconTile, Notice, SkeletonCards } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const booking = useResource(() => api.GET("/bookings/{booking_id}", { params: { path: { booking_id: Number(id) } } }), [id]);
  const offerings = useResource(() => api.GET("/offerings"));
  const { attend, busyId, notice } = useAttendance(() => void booking.refresh());
  const b = booking.data;
  const offering = b ? offerings.data?.find((o) => o.id === b.offering_id) : undefined;

  return (
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="pb-10">
        <FlowHeader fallback="/(staff)/(tabs)">
          {b ? (
            <View className="gap-2">
              <View className="self-start rounded-full bg-surface-raised px-3 py-1">
                <Text className="text-xs font-bold text-primary">{BOOKING_LABELS[b.status]}</Text>
              </View>
              <Text accessibilityRole="header" className="text-2xl font-extrabold tracking-[-0.8px] text-on-primary">
                {formatTime(b.starts_at)} a {formatTime(b.ends_at)}
              </Text>
              <Text className="text-md text-on-primary opacity-85">{sentenceCase(formatLongDay(b.starts_at))}</Text>
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
          {notice ? <Notice tone={notice.tone} icon={notice.tone === "success" ? "check" : "alert"} text={notice.text} /> : null}
          {!b && !booking.error ? <SkeletonCards count={3} /> : null}
          {b ? (
            <>
              <Rise>
                <Card className="gap-4">
                  <View className="flex-row items-center gap-3">
                    <IconTile icon="pin" size={48} />
                    <View className="flex-1">
                      <Text className="text-xs font-semibold text-text-muted">Dirección</Text>
                      <Text className="text-md font-bold text-text">{b.address}</Text>
                    </View>
                  </View>
                  <Button variant="soft" icon="pin" label="Cómo llegar" hint="Abre la app de mapas" onPress={() => openDirections(b.address)} />
                </Card>
              </Rise>

              <Rise index={1}>
                <Card className="gap-4">
                  <View className="flex-row items-center justify-between">
                    <Text accessibilityRole="header" className="text-lg font-bold text-text">Avance</Text>
                    <Badge label={BOOKING_LABELS[b.status]} tone={BOOKING_TONES[b.status]} />
                  </View>
                  {onTimeline(b.status) ? (
                    <StatusTimeline
                      status={b.status}
                      notes={{ Confirmada: "Pago del cliente recibido", "En curso": "Registraste tu entrada", Completada: "Registraste tu salida" }}
                    />
                  ) : (
                    <Notice tone="neutral" text={BOOKING_LABELS[b.status]} />
                  )}
                </Card>
              </Rise>

              {offering ? (
                <Rise index={2}>
                  <Card className="gap-3">
                    <Text accessibilityRole="header" className="text-lg font-bold text-text">Servicio</Text>
                    <View className="flex-row items-center gap-3">
                      <IconTile icon="sparkle" tone="accent" size={44} />
                      <View className="flex-1">
                        <Text className="text-md font-bold text-text">{offering.name}</Text>
                        <Text className="text-sm text-text-muted">{formatDuration(offering.duration_minutes)}</Text>
                      </View>
                    </View>
                    <Text className="text-sm text-text-muted">El cliente pone los productos y utensilios de limpieza.</Text>
                  </Card>
                </Rise>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>

      {b && canAttend(b) ? (
        <View className="rounded-t-2xl bg-surface-raised px-5 pt-4" style={[{ paddingBottom: Math.max(insets.bottom, 16) }, shadow("3")]}>
          <Button icon={b.status === "confirmed" ? "pin" : "check"} label={attendLabel(b)} hint="Usa tu ubicación actual una sola vez" busy={busyId === b.id} onPress={() => attend(b)} />
        </View>
      ) : null}
    </View>
  );
}
