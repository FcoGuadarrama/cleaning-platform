import type { Schemas } from "@repo/api-client";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "../../../src/api";
import { DateBlock } from "../../../src/DateBlock";
import { BOOKING_LABELS, BOOKING_TONES, businessDayInstant, formatLongDay, formatMonthYear, formatRange, formatShortDay, sentenceCase, weekOf, ymdOf } from "../../../src/format";
import { Icon } from "../../../src/icons";
import { Rise } from "../../../src/motion";
import { Screen } from "../../../src/screen";
import { Text } from "../../../src/text";
import { color } from "../../../src/theme";
import { Avatar, Button, Callout, Card, Hairline, LargeTitle, List, Row, SectionTitle, SkeletonCard, StateView, StatusLine, TextLink, UnderlineTabs } from "../../../src/ui";
import { useResource } from "../../../src/useResource";
import { UPCOMING, visitPrice, visitTitle } from "../../../src/visits";
import { WeekStrip } from "../../../src/WeekStrip";

type Booking = Schemas["BookingOut"];
type Tab = "upcoming" | "history";

const openVisit = (b: Booking) => router.push({ pathname: "/(customer)/booking/[id]", params: { id: String(b.id) } });

function VisitCard({ booking, offering, staffName }: { booking: Booking; offering?: Schemas["OfferingOut"]; staffName?: string }) {
  return (
    <Card className="gap-4">
      <View className="flex-row items-center gap-4">
        <Avatar name={staffName ?? "?"} size="lg" />
        <View className="w-px self-stretch bg-border" />
        <View className="flex-1 gap-0.5">
          <Text className="text-lg font-semibold text-text">{formatRange(booking.starts_at, booking.ends_at)}</Text>
          {visitTitle(booking, offering) ? <Text className="text-sm text-text">{visitTitle(booking, offering)}</Text> : null}
          <Text className="text-sm text-text">{staffName ?? "Personal asignado"}</Text>
          <View className="pt-1">
            <StatusLine label={BOOKING_LABELS[booking.status]} tone={BOOKING_TONES[booking.status]} />
          </View>
        </View>
      </View>
      <Hairline />
      <View className="flex-row items-center gap-2">
        <Icon name="pin" size={18} color={color.text} strokeWidth={1.6} />
        <Text numberOfLines={1} className="flex-1 text-sm text-text">{booking.address}</Text>
        <Text className="text-md font-semibold text-text">{visitPrice(booking)}</Text>
      </View>
      <View className="flex-row gap-3">
        <Button label="Ver detalle" variant="outline" className="flex-1" onPress={() => openVisit(booking)} />
        <Button label="Cambiar fecha" variant="outline" className="flex-1" soon />
      </View>
    </Card>
  );
}

function HistoryRow({ booking, offering }: { booking: Booking; offering?: Schemas["OfferingOut"] }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ver visita del ${formatLongDay(booking.starts_at)}`} onPress={() => openVisit(booking)} className="flex-row items-center gap-4 py-3 active:opacity-60">
      <DateBlock iso={booking.starts_at} size="sm" />
      <View className="flex-1 gap-1">
        <Text className="text-md font-semibold text-text">{formatRange(booking.starts_at, booking.ends_at)}</Text>
        {visitTitle(booking, offering) ? <Text className="text-sm text-text-muted">{visitTitle(booking, offering)}</Text> : null}
        <StatusLine label={BOOKING_LABELS[booking.status]} tone={BOOKING_TONES[booking.status]} />
      </View>
      <Icon name="arrow" size={20} color={color.text} strokeWidth={1.6} />
    </Pressable>
  );
}

export default function Visits() {
  const bookings = useResource(() => api.GET("/bookings"));
  const offerings = useResource(() => api.GET("/offerings"));
  const staff = useResource(() => api.GET("/staff"));
  const [tab, setTab] = useState<Tab>("upcoming");
  const [picked, setPicked] = useState<string | null>(null);
  const [weekShift, setWeekShift] = useState(0);

  const sorted = [...(bookings.data ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const upcoming = sorted.filter((b) => UPCOMING.has(b.status));
  const history = sorted.filter((b) => !UPCOMING.has(b.status)).reverse();
  const offeringOf = (id: number | null) => offerings.data?.find((o) => o.id === id);
  const staffName = (id: number) => staff.data?.find((s) => s.id === id)?.display_name;

  // Until the person picks a day, the strip opens on their next visit (or today).
  const today = ymdOf(new Date());
  const selected = picked ?? (upcoming[0] ? ymdOf(upcoming[0].starts_at) : today);
  const days = weekOf(selected, weekShift);
  const marked = new Set(upcoming.map((b) => ymdOf(b.starts_at)));
  const ofDay = upcoming.filter((b) => ymdOf(b.starts_at) === selected);
  const nextElsewhere = upcoming.find((b) => ymdOf(b.starts_at) > selected) ?? upcoming[0];

  function pick(ymd: string) {
    setPicked(ymd);
    setWeekShift(0);
  }

  const arrows = (
    <View className="flex-row">
      {(["back", "chevron"] as const).map((name, i) => (
        <Pressable
          key={name}
          accessibilityRole="button"
          accessibilityLabel={i ? "Semana siguiente" : "Semana anterior"}
          onPress={() => setWeekShift(weekShift + (i ? 1 : -1))}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-surface"
        >
          <Icon name={name} size={24} color={color.text} strokeWidth={1.8} />
        </Pressable>
      ))}
    </View>
  );

  return (
    <Screen onRefresh={bookings.refresh}>
      <View className="gap-5">
        <LargeTitle overline={formatMonthYear(businessDayInstant(days[3]!))} title="Tus visitas" trailing={tab === "upcoming" ? arrows : undefined} />
        <UnderlineTabs<Tab> value={tab} onChange={setTab} options={[{ value: "upcoming", label: "Próximas" }, { value: "history", label: "Historial" }]} />
      </View>

      {tab === "upcoming" ? (
        <>
          <View className="-mt-1 gap-5">
            <WeekStrip days={days} selected={selected} marked={marked} onSelect={pick} />
            <Text accessibilityRole="header" className="text-xl font-semibold tracking-[-0.5px] text-text">{sentenceCase(formatLongDay(businessDayInstant(selected)))}</Text>
            <StateView loading={bookings.loading} error={bookings.error} empty={false} emptyTitle="" onRetry={bookings.refresh} skeleton={<SkeletonCard />}>
              {ofDay.length ? (
                <View className="gap-3">
                  {ofDay.map((b, i) => (
                    <Rise key={b.id} index={i}>
                      <VisitCard booking={b} offering={offeringOf(b.offering_id)} staffName={staffName(b.staff_id)} />
                    </Rise>
                  ))}
                </View>
              ) : (
                <View className="gap-1">
                  <Text className="text-md text-text-muted">No tienes visitas este día.</Text>
                  {nextElsewhere ? (
                    <TextLink label={`Ir a tu próxima visita: ${formatShortDay(nextElsewhere.starts_at)}`} onPress={() => pick(ymdOf(nextElsewhere.starts_at))} />
                  ) : (
                    <TextLink label="Reservar una visita" onPress={() => router.navigate("/(customer)/(tabs)")} />
                  )}
                </View>
              )}
            </StateView>
          </View>

          <View className="gap-1">
            <SectionTitle title="Después de tu visita" />
            <List>
              <Row icon="star" title="Califica el servicio" subtitle="Disponible al finalizar" soon />
            </List>
          </View>

          <Callout icon="headset">
            <Text className="text-md font-semibold text-text">¿Cambió tu semana?</Text>
            <Text className="text-sm text-text">Te ayudamos a reorganizar tu visita.</Text>
            <TextLink label="Hablar con soporte" soon />
          </Callout>
        </>
      ) : (
        <StateView loading={bookings.loading} error={bookings.error} empty={!history.length} emptyIcon="calendar" emptyTitle="Aún no hay visitas anteriores" onRetry={bookings.refresh}>
          <List>
            {history.map((b) => (
              <HistoryRow key={b.id} booking={b} offering={offeringOf(b.offering_id)} />
            ))}
          </List>
        </StateView>
      )}
    </Screen>
  );
}
