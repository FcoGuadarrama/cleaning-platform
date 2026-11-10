import { router } from "expo-router";
import { View } from "react-native";
import { formatAmount, formatDuration, formatMoney } from "./format";
import { Icon } from "./icons";
import { PressableScale } from "./motion";
import { daysLabel, perVisitMinor, type Plan } from "./plans";
import { Text } from "./text";
import { color } from "./theme";

/** A monthly plan as a tappable card. `featured` draws the brand outline used for the first plan on Inicio. */
export function PlanCard({ plan, featured = false }: { plan: Plan; featured?: boolean }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${plan.name}, ${formatMoney(plan.price_minor, plan.currency)} al mes. Ver detalle`}
      onPress={() => router.push({ pathname: "/(customer)/plans/[id]", params: { id: String(plan.id) } })}
      scaleTo={0.98}
      className={`gap-4 rounded-lg bg-background p-5 ${featured ? "border-[1.5px] border-primary" : "border border-border"}`}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-lg font-semibold tracking-[-0.3px] text-text">{plan.name}</Text>
          {plan.description ? <Text className="text-sm text-text-muted">{plan.description}</Text> : null}
        </View>
        <Icon name="arrow" size={20} color={featured ? color.primary : color.text} strokeWidth={1.6} />
      </View>
      <View className="gap-0.5">
        <View className="flex-row items-baseline gap-1.5">
          <Text className="text-[30px] font-semibold leading-[34px] tracking-[-1px] text-text">{formatAmount(plan.price_minor, plan.currency)}</Text>
          <Text className="text-sm text-text-muted">{plan.currency} al mes</Text>
        </View>
        <Text className="text-sm text-text-muted">Equivale a {formatMoney(perVisitMinor(plan), plan.currency)} por visita</Text>
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
