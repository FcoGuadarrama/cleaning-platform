import { FlatList, Text, View } from "react-native";
import { api } from "../../src/api";
import { BOOKING_LABELS, formatDateTime, formatMoney } from "../../src/format";
import { Card, StateView } from "../../src/ui";
import { useResource } from "../../src/useResource";

export default function MyBookings() {
  const bookings = useResource(() => api.GET("/bookings"));
  return (
    <View className="flex-1 bg-background">
      <StateView loading={bookings.loading} error={bookings.error} empty={!bookings.data?.length} emptyText="Todavía no tienes reservas." onRetry={bookings.refresh}>
        <FlatList
          data={bookings.data ?? []}
          keyExtractor={(b) => String(b.id)}
          contentContainerClassName="gap-3 p-4"
          onRefresh={bookings.refresh}
          refreshing={bookings.loading}
          renderItem={({ item }) => (
            <Card>
              <Text className="text-md font-semibold text-text">{formatDateTime(item.starts_at)}</Text>
              <Text className="text-md text-text-muted">{BOOKING_LABELS[item.status]} · {formatMoney(item.price_minor, item.currency)}</Text>
            </Card>
          )}
        />
      </StateView>
    </View>
  );
}
