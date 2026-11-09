import { useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
import { api } from "../../../src/api";
import { attendLabel, canAttend, openDirections, useAttendance } from "../../../src/attendance";
import { BOOKING_LABELS, BOOKING_TONES, formatDuration, formatLongDay, formatRange, sentenceCase } from "../../../src/format";
import { Skeleton } from "../../../src/motion";
import { FlowScreen } from "../../../src/screen";
import { Text } from "../../../src/text";
import { Button, Callout, List, Notice, Row, SkeletonRows, StatusChip } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useResource(() => api.GET("/bookings/{booking_id}", { params: { path: { booking_id: Number(id) } } }), [id]);
  const offerings = useResource(() => api.GET("/offerings"));
  const { attend, busyId, notice } = useAttendance(() => void booking.refresh());
  const b = booking.data;
  const offering = b ? offerings.data?.find((o) => o.id === b.offering_id) : undefined;

  return (
    <FlowScreen
      title="Detalle del servicio"
      fallback="/(staff)/(tabs)"
      footer={b && canAttend(b) ? <Button icon={b.status === "confirmed" ? "pin" : "check"} label={attendLabel(b)} hint="Usa tu ubicación actual una sola vez" busy={busyId === b.id} onPress={() => attend(b)} /> : undefined}
    >
      {booking.error ? <Notice tone="danger" text={booking.error} /> : null}
      {notice ? <Notice tone={notice.tone} text={notice.text} /> : null}
      {!b && !booking.error ? (
        <View className="gap-3">
          <Skeleton className="h-7 w-28 rounded-md" />
          <Skeleton className="h-10 w-48" />
          <SkeletonRows count={3} />
        </View>
      ) : null}
      {b ? (
        <>
          <View className="gap-2">
            <StatusChip label={BOOKING_LABELS[b.status]} tone={BOOKING_TONES[b.status]} />
            <Text accessibilityRole="header" className="text-[34px] font-semibold leading-[42px] tracking-[-1px] text-text">{formatRange(b.starts_at, b.ends_at)}</Text>
            <Text className="text-md text-text">{sentenceCase(formatLongDay(b.starts_at))}</Text>
          </View>
          <List>
            <Row
              icon="pin"
              title="Domicilio"
              subtitle={b.address}
              trailing={
                <Pressable accessibilityRole="button" accessibilityHint="Abre la app de mapas" onPress={() => openDirections(b.address)} className="min-h-11 justify-center active:opacity-60">
                  <Text className="border-b border-primary text-md font-semibold text-primary">Cómo llegar</Text>
                </Pressable>
              }
            />
            {offering ? <Row icon="broom" title={offering.name} subtitle={formatDuration(offering.duration_minutes)} /> : null}
          </List>
          <Callout icon="spray">
            <Text className="text-md font-semibold text-text">El cliente proporciona los productos y herramientas.</Text>
          </Callout>
        </>
      ) : null}
    </FlowScreen>
  );
}
