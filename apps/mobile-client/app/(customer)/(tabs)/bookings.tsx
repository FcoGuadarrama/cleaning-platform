import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { api } from "../../../src/api";
import { DateBlock } from "../../../src/DateBlock";
import { BOOKING_LABELS, BOOKING_TONES, formatMoney, formatTime } from "../../../src/format";
import { Badge, Button, Card, EmptyState, HeroPage, HeroText, Segmented, StateView } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

const FINISHED = new Set(["completed", "cancelled", "expired"]);
type Tab = "upcoming" | "past";

export default function MyBookings() {
  const bookings = useResource(() => api.GET("/bookings"));
  const staff = useResource(() => api.GET("/staff"));
  const [tab, setTab] = useState<Tab>("upcoming");
  const staffName = new Map((staff.data ?? []).map((s) => [s.id, s.display_name]));
  const sorted = [...(bookings.data ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const upcoming = sorted.filter((b) => !FINISHED.has(b.status));
  const past = sorted.filter((b) => FINISHED.has(b.status)).reverse();
  const shown = tab === "upcoming" ? upcoming : past;

  return (
    <HeroPage
      onRefresh={bookings.refresh}
      hero={<HeroText title="Mis reservas" subtitle={upcoming.length ? `${upcoming.length} ${upcoming.length === 1 ? "visita próxima" : "visitas próximas"}` : "Aquí verás tus visitas"} />}
    >
      <Segmented<Tab> value={tab} onChange={setTab} options={[{ value: "upcoming", label: "Próximas" }, { value: "past", label: "Anteriores" }]} />
      <StateView loading={bookings.loading} error={bookings.error} empty={false} emptyTitle="" onRetry={bookings.refresh}>
        {shown.length ? (
          <View className="gap-3">
            {shown.map((b) => (
              <Card key={b.id}>
                <View className="flex-row items-center gap-4">
                  <DateBlock iso={b.starts_at} />
                  <View className="flex-1 gap-1.5">
                    <Text className="text-md font-bold text-text">
                      {formatTime(b.starts_at)}
                      {staffName.has(b.staff_id) ? <Text className="font-medium text-text-muted"> con {staffName.get(b.staff_id)}</Text> : null}
                    </Text>
                    <Text numberOfLines={1} className="text-sm text-text-muted">{b.address}</Text>
                    <Badge label={BOOKING_LABELS[b.status]} tone={BOOKING_TONES[b.status]} />
                  </View>
                  <Text className="text-md font-extrabold text-text">{formatMoney(b.price_minor, b.currency)}</Text>
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <View className="gap-4">
            <EmptyState
              icon="calendar"
              title={tab === "upcoming" ? "No tienes visitas próximas" : "Aún no hay visitas anteriores"}
              text={tab === "upcoming" ? "Elige a una persona del equipo para reservar." : undefined}
            />
            {tab === "upcoming" ? <Button label="Reservar una visita" icon="sparkle" onPress={() => router.navigate("/(customer)/(tabs)")} /> : null}
          </View>
        )}
      </StateView>
    </HeroPage>
  );
}
