import { Text, View } from "react-native";
import { api } from "../../../src/api";
import { DateBlock } from "../../../src/DateBlock";
import { BOOKING_LABELS, BOOKING_TONES, formatMoney, formatTime } from "../../../src/format";
import { Badge, Group, Page, Section, StateView } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

const FINISHED = new Set(["completed", "cancelled", "expired"]);

export default function MyBookings() {
  const bookings = useResource(() => api.GET("/bookings"));
  const staff = useResource(() => api.GET("/staff"));
  const staffName = new Map((staff.data ?? []).map((s) => [s.id, s.display_name]));
  const sorted = [...(bookings.data ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const upcoming = sorted.filter((b) => !FINISHED.has(b.status));
  const past = sorted.filter((b) => FINISHED.has(b.status)).reverse();

  const list = (items: typeof sorted) => (
    <Group>
      {items.map((b) => (
        <View key={b.id} className="flex-row items-center gap-4 px-4 py-3">
          <DateBlock iso={b.starts_at} />
          <View className="flex-1 gap-1.5">
            <Text className="text-md font-semibold text-text">
              {formatTime(b.starts_at)}
              {staffName.has(b.staff_id) ? <Text className="font-normal text-text-muted"> con {staffName.get(b.staff_id)}</Text> : null}
            </Text>
            <Badge label={BOOKING_LABELS[b.status]} tone={BOOKING_TONES[b.status]} />
          </View>
          <Text className="text-md font-semibold text-text">{formatMoney(b.price_minor, b.currency)}</Text>
        </View>
      ))}
    </Group>
  );

  return (
    <Page title="Mis reservas" onRefresh={bookings.refresh}>
      <StateView
        loading={bookings.loading}
        error={bookings.error}
        empty={!sorted.length}
        emptyIcon="calendar"
        emptyTitle="Todavía no tienes reservas"
        emptyText="Elige a una persona en Personal para reservar tu primera visita."
        onRetry={bookings.refresh}
      >
        {upcoming.length ? <Section title="Próximas">{list(upcoming)}</Section> : null}
        {past.length ? <Section title="Anteriores">{list(past)}</Section> : null}
      </StateView>
    </Page>
  );
}
