import { router } from "expo-router";
import { View } from "react-native";
import { api } from "../../../src/api";
import { formatDuration, formatMoney } from "../../../src/format";
import { Icon } from "../../../src/icons";
import { PressableScale, Rise } from "../../../src/motion";
import { daysLabel, type Plan } from "../../../src/plans";
import { FlowScreen } from "../../../src/screen";
import { Text } from "../../../src/text";
import { color } from "../../../src/theme";
import { Notice, SkeletonCard, StateView } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${plan.name}, ${formatMoney(plan.price_minor, plan.currency)} al mes. Ver detalle`}
      onPress={() => router.push({ pathname: "/(customer)/plans/[id]", params: { id: String(plan.id) } })}
      scaleTo={0.98}
      className="gap-4 rounded-lg border border-border bg-background p-5"
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-lg font-semibold tracking-[-0.3px] text-text">{plan.name}</Text>
          {plan.description ? <Text className="text-sm text-text-muted">{plan.description}</Text> : null}
        </View>
        <Icon name="arrow" size={20} color={color.text} strokeWidth={1.6} />
      </View>
      <View className="flex-row items-baseline gap-1.5">
        <Text className="text-[30px] font-semibold leading-[34px] tracking-[-1px] text-text">{formatMoney(plan.price_minor, plan.currency).replace(` ${plan.currency}`, "")}</Text>
        <Text className="text-sm text-text-muted">{plan.currency} al mes</Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {[`${plan.visits_per_cycle} visitas al mes`, daysLabel(plan.days_per_week), formatDuration(plan.visit_duration_minutes)].map((fact) => (
          <View key={fact} className="rounded-full bg-primary-soft px-3 py-1.5">
            <Text className="text-sm font-medium text-primary">{fact}</Text>
          </View>
        ))}
      </View>
    </PressableScale>
  );
}

export default function Plans() {
  const plans = useResource(() => api.GET("/subscription-plans"));

  return (
    <FlowScreen title="Planes mensuales" fallback="/(customer)/(tabs)">
      <View className="gap-2">
        <Text accessibilityRole="header" className="text-2xl font-bold leading-[38px] tracking-[-1px] text-text">
          La misma persona,{"\n"}los mismos días.
        </Text>
        <Text className="text-md leading-[24px] text-text">
          Eliges qué días de lunes a viernes y pagas una cantidad fija al mes. Cada día que elijas son 4 visitas al mes.
        </Text>
      </View>
      <Notice text="Pronto podrás contratar un plan desde la app. Por ahora puedes ver los planes y sus condiciones." />
      <StateView
        loading={plans.loading}
        error={plans.error}
        empty={!plans.data?.length}
        emptyIcon="layers"
        emptyTitle="Aún no hay planes disponibles"
        emptyText="Mientras tanto puedes reservar visitas sueltas desde Inicio."
        onRetry={plans.refresh}
        skeleton={<SkeletonCard />}
      >
        <View className="gap-3">
          {(plans.data ?? []).map((p, i) => (
            <Rise key={p.id} index={i}>
              <PlanCard plan={p} />
            </Rise>
          ))}
        </View>
      </StateView>
    </FlowScreen>
  );
}
