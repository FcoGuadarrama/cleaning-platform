import type { Schemas } from "@repo/api-client";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "../../../src/api";
import { Bell } from "../../../src/Bell";
import { attendLabel, canAttend, openDirections, useAttendance } from "../../../src/attendance";
import { DateBlock } from "../../../src/DateBlock";
import { BOOKING_LABELS, BOOKING_TONES, formatLongDay, formatRange, formatRelativeDay, sentenceCase } from "../../../src/format";
import { Icon } from "../../../src/icons";
import { Rise } from "../../../src/motion";
import { Screen } from "../../../src/screen";
import { useSession } from "../../../src/session";
import { Text } from "../../../src/text";
import { color } from "../../../src/theme";
import { Button, Card, EmptyState, Hairline, LargeTitle, List, Notice, SectionTitle, SkeletonCard, StateView, StatusChip, StatusLine, UnderlineTabs } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

type Booking = Schemas["BookingOut"];
type Tab = "upcoming" | "history";

const openJob = (b: Booking) => router.push({ pathname: "/(staff)/job/[id]", params: { id: String(b.id) } });

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 gap-0.5 rounded-md bg-primary-soft px-4 py-3">
      <Text className="text-2xl font-semibold leading-[34px] text-text">{value}</Text>
      <Text className="text-sm text-text">{label}</Text>
    </View>
  );
}

/** The service to act on now: one in progress, otherwise the earliest confirmed. */
function NextService({ booking, busy, onAttend }: { booking: Booking; busy: boolean; onAttend: () => void }) {
  return (
    <Card className="gap-4">
      <View className="flex-row items-center justify-between">
        <StatusChip label={booking.status === "in_progress" ? "En curso" : "Siguiente servicio"} tone={booking.status === "in_progress" ? "primary" : "success"} />
        <Pressable accessibilityRole="button" onPress={() => openJob(booking)} className="min-h-11 flex-row items-center gap-1.5 pl-3 active:opacity-60">
          <Text className="text-md font-semibold text-primary">Ver detalle</Text>
          <Icon name="arrow" size={18} color={color.primary} strokeWidth={1.8} />
        </Pressable>
      </View>
      <View className="gap-0.5">
        <Text className="text-sm text-text">{sentenceCase(formatRelativeDay(booking.starts_at))}</Text>
        <Text className="text-2xl font-semibold leading-[38px] tracking-[-1px] text-text">{formatRange(booking.starts_at, booking.ends_at)}</Text>
      </View>
      <Hairline />
      <View className="flex-row items-center gap-3">
        <Icon name="pin" size={22} color={color.text} strokeWidth={1.6} />
        <Text numberOfLines={2} className="flex-1 text-md text-text">{booking.address}</Text>
        <Pressable accessibilityRole="button" onPress={() => openDirections(booking.address)} className="min-h-11 justify-center active:opacity-60">
          <Text className="border-b border-primary text-md font-semibold text-primary">Cómo llegar</Text>
        </Pressable>
      </View>
      <Button icon={booking.status === "in_progress" ? "check" : "pin"} label={attendLabel(booking)} hint="Usa tu ubicación actual una sola vez" busy={busy} onPress={onAttend} />
    </Card>
  );
}

function AgendaRow({ booking }: { booking: Booking }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ver servicio del ${formatLongDay(booking.starts_at)}`} onPress={() => openJob(booking)} className="flex-row items-center gap-4 py-3 active:opacity-60">
      <DateBlock iso={booking.starts_at} size="sm" />
      <View className="flex-1 gap-1">
        <Text className="text-md font-semibold text-text">{formatRange(booking.starts_at, booking.ends_at)}</Text>
        <Text numberOfLines={1} className="text-sm text-text-muted">{booking.address}</Text>
        <StatusLine label={BOOKING_LABELS[booking.status]} tone={BOOKING_TONES[booking.status]} />
      </View>
      <Icon name="arrow" size={20} color={color.text} strokeWidth={1.6} />
    </Pressable>
  );
}

export default function StaffHome() {
  const { user } = useSession();
  const bookings = useResource(() => api.GET("/bookings"));
  const { attend, busyId, notice } = useAttendance(() => void bookings.refresh());
  const [tab, setTab] = useState<Tab>("upcoming");

  const sorted = [...(bookings.data ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const upcoming = sorted.filter(canAttend);
  // Newest first: the services just finished matter more than the ones from months ago.
  const history = sorted.filter((b) => !canAttend(b)).reverse();
  const next = upcoming.find((b) => b.status === "in_progress") ?? upcoming[0];
  const rest = upcoming.filter((b) => b.id !== next?.id);
  const done = sorted.filter((b) => b.status === "completed" || b.status === "pending_review").length;
  const firstName = user?.full_name.split(/\s+/)[0] ?? "";

  return (
    <Screen onRefresh={bookings.refresh}>
      <View className="gap-5">
        <LargeTitle overline={`Hola, ${firstName}`} title="Tus servicios" trailing={<Bell role="staff" />} />
        <View className="flex-row gap-3">
          <Stat value={upcoming.length} label="Por hacer" />
          <Stat value={done} label="Terminados" />
        </View>
        <UnderlineTabs<Tab> value={tab} onChange={setTab} options={[{ value: "upcoming", label: "Próximos" }, { value: "history", label: "Historial" }]} />
      </View>
      {notice ? <Notice tone={notice.tone} text={notice.text} /> : null}
      <StateView
        loading={bookings.loading}
        error={bookings.error}
        empty={!sorted.length}
        emptyIcon="calendar"
        emptyTitle="No tienes servicios asignados"
        emptyText="Cuando administración te asigne una visita aparecerá aquí."
        onRetry={bookings.refresh}
        skeleton={<SkeletonCard />}
      >
        {tab === "upcoming" ? (
          <View className="gap-7">
            {next ? (
              <Rise>
                <NextService booking={next} busy={busyId === next.id} onAttend={() => attend(next)} />
              </Rise>
            ) : (
              <EmptyState icon="calendar" title="No tienes servicios próximos" text="Cuando administración te asigne una visita aparecerá aquí." />
            )}
            {rest.length ? (
              <View className="gap-1">
                <SectionTitle title="Agenda" trailing={<Text className="text-sm text-text-muted">{rest.length} más</Text>} />
                <List>
                  {rest.map((b) => (
                    <AgendaRow key={b.id} booking={b} />
                  ))}
                </List>
              </View>
            ) : null}
          </View>
        ) : history.length ? (
          <List>
            {history.map((b) => (
              <AgendaRow key={b.id} booking={b} />
            ))}
          </List>
        ) : (
          <EmptyState icon="calendar" title="Aún no tienes historial" text="Los servicios terminados o cancelados aparecerán aquí." />
        )}
      </StateView>
    </Screen>
  );
}
