import { router } from "expo-router";
import { View } from "react-native";
import { api } from "../../../src/api";
import { formatDuration, formatMoney } from "../../../src/format";
import { Rise } from "../../../src/motion";
import { PlanCard } from "../../../src/PlanCard";
import { Screen } from "../../../src/screen";
import { Text } from "../../../src/text";
import { LargeTitle, List, Notice, Row, SectionTitle, SkeletonCard, SkeletonRows, StateView } from "../../../src/ui";
import { useResource } from "../../../src/useResource";
import { serviceIcon } from "../../../src/visits";

export default function Plans() {
  const plans = useResource(() => api.GET("/subscription-plans"));
  const offerings = useResource(() => api.GET("/offerings"));

  function refresh() {
    void plans.refresh();
    void offerings.refresh();
  }

  return (
    <Screen onRefresh={refresh}>
      <View className="gap-2">
        <LargeTitle title="Planes mensuales" />
        <Text className="text-md leading-[24px] text-text">
          La misma persona, los mismos días y un precio fijo al mes. Cada día de la semana que elijas son 4 visitas al mes.
        </Text>
      </View>

      <View className="gap-3">
        <Notice text="Pronto podrás contratar un plan desde la app. Por ahora puedes ver los planes y sus condiciones." />
        <StateView
          loading={plans.loading}
          error={plans.error}
          empty={!plans.data?.length}
          emptyIcon="layers"
          emptyTitle="Aún no hay planes disponibles"
          emptyText="Estamos preparando los planes. Mientras tanto puedes reservar una visita suelta aquí abajo."
          onRetry={plans.refresh}
          skeleton={<SkeletonCard />}
        >
          <View className="gap-3">
            {(plans.data ?? []).map((p, i) => (
              <Rise key={p.id} index={i}>
                <PlanCard plan={p} featured={i === 0} />
              </Rise>
            ))}
          </View>
        </StateView>
      </View>

      <View className="gap-1">
        <View className="gap-1">
          <SectionTitle title="¿Solo una vez?" />
          <Text className="text-sm text-text-muted">Reserva una visita suelta, sin plan.</Text>
        </View>
        <StateView
          loading={offerings.loading}
          error={offerings.error}
          empty={!offerings.data?.length}
          emptyIcon="broom"
          emptyTitle="Aún no hay servicios disponibles"
          onRetry={offerings.refresh}
          skeleton={<SkeletonRows count={2} />}
        >
          <List>
            {(offerings.data ?? []).map((o, i) => (
              <Row
                key={o.id}
                icon={serviceIcon(i)}
                title={o.name}
                subtitle={`${formatDuration(o.duration_minutes)} · ${formatMoney(o.price_minor, o.currency)}`}
                accessibilityLabel={`Reservar ${o.name}`}
                onPress={() => router.push({ pathname: "/(customer)/book", params: { offeringId: String(o.id) } })}
              />
            ))}
          </List>
        </StateView>
      </View>
    </Screen>
  );
}
