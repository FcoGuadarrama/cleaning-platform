import type { Schemas } from "@repo/api-client";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { api } from "../../../src/api";
import { attendLabel, canAttend, openDirections, useAttendance } from "../../../src/attendance";
import { DateBlock } from "../../../src/DateBlock";
import { BOOKING_LABELS, BOOKING_TONES, formatRelativeDay, formatTime } from "../../../src/format";
import { Icon } from "../../../src/icons";
import { Rise } from "../../../src/motion";
import { useSession } from "../../../src/session";
import { alpha, color } from "../../../src/theme";
import { Badge, Button, Card, HeroPage, HeroText, IconTile, Notice, SectionHeader, SkeletonCards, StateView } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

type Booking = Schemas["BookingOut"];

const openJob = (b: Booking) => router.push({ pathname: "/(staff)/job/[id]", params: { id: String(b.id) } });

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 gap-0.5 rounded-xl px-4 py-3" style={{ backgroundColor: alpha(color["on-primary"], 0.14) }}>
      <Text className="text-xl font-extrabold text-on-primary">{value}</Text>
      <Text className="text-xs font-semibold text-on-primary opacity-80">{label}</Text>
    </View>
  );
}

/** The service to act on now: one in progress, otherwise the earliest confirmed. */
function NextService({ booking, busy, onAttend }: { booking: Booking; busy: boolean; onAttend: () => void }) {
  const started = booking.status === "in_progress";
  return (
    <Card className="gap-5 p-5">
      <View className="flex-row items-center justify-between">
        <Badge label={started ? "En curso" : "Siguiente servicio"} tone={started ? "primary" : "success"} />
        <Pressable accessibilityRole="button" onPress={() => openJob(booking)} className="min-h-11 flex-row items-center gap-0.5 pl-3 active:opacity-70">
          <Text className="text-sm font-bold text-primary">Ver detalle</Text>
          <Icon name="chevron" size={16} color={color.primary} strokeWidth={2.4} />
        </Pressable>
      </View>
      <View className="gap-0.5">
        <Text className="text-sm font-semibold text-text-muted">{formatRelativeDay(booking.starts_at)}</Text>
        <Text className="text-2xl font-extrabold tracking-[-0.8px] text-text">
          {formatTime(booking.starts_at)} <Text className="text-xl font-bold text-text-muted">a {formatTime(booking.ends_at)}</Text>
        </Text>
      </View>
      <View className="flex-row items-center gap-3 rounded-lg bg-surface p-3">
        <IconTile icon="pin" size={40} />
        <Text numberOfLines={2} className="flex-1 text-md font-medium text-text">{booking.address}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cómo llegar"
          onPress={() => openDirections(booking.address)}
          className="min-h-11 justify-center rounded-full bg-surface-raised px-3 active:opacity-80"
        >
          <Text className="text-sm font-bold text-primary">Cómo llegar</Text>
        </Pressable>
      </View>
      <Button icon={started ? "check" : "pin"} label={attendLabel(booking)} hint="Usa tu ubicación actual una sola vez" busy={busy} onPress={onAttend} />
    </Card>
  );
}

export default function StaffHome() {
  const { user } = useSession();
  const bookings = useResource(() => api.GET("/bookings"));
  const { attend, busyId, notice } = useAttendance(() => void bookings.refresh());

  const sorted = [...(bookings.data ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const next = sorted.find((b) => b.status === "in_progress") ?? sorted.find((b) => b.status === "confirmed");
  const rest = sorted.filter((b) => b.id !== next?.id);
  const pending = sorted.filter(canAttend).length;
  const done = sorted.filter((b) => b.status === "completed" || b.status === "pending_review").length;
  const firstName = user?.full_name.split(/\s+/)[0] ?? "";

  return (
    <HeroPage
      title="Tus servicios"
      onRefresh={bookings.refresh}
      hero={
        <View className="gap-5">
          <HeroText kicker={`Hola, ${firstName}`} title="Tus servicios" />
          <View className="flex-row gap-3">
            <HeroStat value={pending} label="Por hacer" />
            <HeroStat value={done} label="Terminados" />
          </View>
        </View>
      }
    >
      {notice ? <Notice tone={notice.tone} icon={notice.tone === "success" ? "check" : "alert"} text={notice.text} /> : null}
      <StateView
        loading={bookings.loading}
        error={bookings.error}
        empty={!sorted.length}
        emptyIcon="calendar"
        emptyTitle="No tienes servicios asignados"
        emptyText="Cuando administración te asigne una visita aparecerá aquí."
        onRetry={bookings.refresh}
        skeleton={<SkeletonCards count={3} />}
      >
        <View className="gap-7">
          {next ? (
            <Rise>
              <NextService booking={next} busy={busyId === next.id} onAttend={() => attend(next)} />
            </Rise>
          ) : null}
          {rest.length ? (
            <View className="gap-3">
              <SectionHeader title="Agenda" detail={`${rest.length} más`} />
              {rest.map((b, i) => (
                <Rise key={b.id} index={i + 1}>
                  <Card onPress={() => openJob(b)} accessibilityLabel={`Ver servicio de las ${formatTime(b.starts_at)}`}>
                    <View className="flex-row items-center gap-4">
                      <DateBlock iso={b.starts_at} />
                      <View className="flex-1 gap-1">
                        <Text className="text-md font-bold text-text">{formatTime(b.starts_at)} a {formatTime(b.ends_at)}</Text>
                        <View className="flex-row items-center gap-1">
                          <Icon name="pin" size={14} color={color["text-muted"]} />
                          <Text numberOfLines={1} className="flex-1 text-sm text-text-muted">{b.address}</Text>
                        </View>
                        <Badge label={BOOKING_LABELS[b.status]} tone={BOOKING_TONES[b.status]} />
                      </View>
                      <Icon name="chevron" size={18} color={color["text-muted"]} />
                    </View>
                  </Card>
                </Rise>
              ))}
            </View>
          ) : null}
        </View>
      </StateView>
    </HeroPage>
  );
}
