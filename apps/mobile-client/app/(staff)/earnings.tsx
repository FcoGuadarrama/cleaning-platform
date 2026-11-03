import { FlatList, Text, View } from "react-native";
import { api } from "../../src/api";
import { formatMoney } from "../../src/format";
import { Card, StateView } from "../../src/ui";
import { useResource } from "../../src/useResource";

const STATUS = { earned: "Generado", approved: "Aprobado", paid: "Pagado" } as const;

export default function Earnings() {
  const summary = useResource(() => api.GET("/me/earnings"));
  const s = summary.data;
  return (
    <View className="flex-1 bg-background">
      <StateView loading={summary.loading} error={summary.error} empty={!s} emptyText="Sin datos." onRetry={summary.refresh}>
        {s ? (
          <FlatList
            data={s.items}
            keyExtractor={(e) => String(e.id)}
            contentContainerClassName="gap-3 p-4"
            ListHeaderComponent={
              <Card>
                <Text className="text-sm text-text-muted">Semana del {s.week_start}</Text>
                <Text className="text-md text-text">Generado: {formatMoney(s.earned_minor, s.currency)}</Text>
                <Text className="text-md text-text">Aprobado: {formatMoney(s.approved_minor, s.currency)}</Text>
                <Text className="text-md text-text">Pagado: {formatMoney(s.paid_minor, s.currency)}</Text>
              </Card>
            }
            ListEmptyComponent={<Text className="p-4 text-md text-text-muted">Aún no hay servicios completados esta semana.</Text>}
            renderItem={({ item }) => (
              <Card>
                <Text className="text-md text-text">Servicio #{item.booking_id} · {formatMoney(item.amount_minor, item.currency)}</Text>
                <Text className="text-sm text-text-muted">{STATUS[item.status]}</Text>
              </Card>
            )}
          />
        ) : null}
      </StateView>
    </View>
  );
}
