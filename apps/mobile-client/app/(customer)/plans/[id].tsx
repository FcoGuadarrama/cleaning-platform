import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { api } from "../../../src/api";
import { formatAmount, formatDuration, formatMoney } from "../../../src/format";
import { Skeleton } from "../../../src/motion";
import { daysLabel, perVisitMinor } from "../../../src/plans";
import { FlowScreen } from "../../../src/screen";
import { Text } from "../../../src/text";
import { Button, EmptyState, List, Notice, Row, SectionTitle, SkeletonRows } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

export default function PlanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plans = useResource(() => api.GET("/subscription-plans"));
  const plan = plans.data?.find((p) => p.id === Number(id));

  return (
    <FlowScreen
      title={plan?.name ?? "Plan mensual"}
      fallback="/(customer)/(tabs)/plans"
      footer={
        plan ? (
          <Button label="Contratar este plan" onPress={() => router.push({ pathname: "/(customer)/subscribe", params: { planId: String(plan.id) } })} />
        ) : undefined
      }
    >
      {plans.error ? <Notice tone="danger" text={plans.error} /> : null}
      {plans.loading ? (
        <View className="gap-3">
          <Skeleton className="h-10 w-48" />
          <SkeletonRows count={4} />
        </View>
      ) : null}
      {!plans.loading && !plans.error && !plan ? (
        <EmptyState icon="layers" title="Este plan ya no está disponible" text="Puede que lo hayan actualizado. Regresa para ver los planes vigentes." />
      ) : null}
      {plan ? (
        <>
          <View className="gap-1">
            {plan.description ? <Text className="text-md text-text">{plan.description}</Text> : null}
            <View className="flex-row items-baseline gap-1.5 pt-2">
              <Text accessibilityRole="header" className="text-[40px] font-semibold leading-[46px] tracking-[-1.4px] text-text">
                {formatAmount(plan.price_minor, plan.currency)}
              </Text>
              <Text className="text-md text-text-muted">{plan.currency} al mes</Text>
            </View>
            <Text className="text-sm text-text-muted">Equivale a {formatMoney(perVisitMinor(plan), plan.currency)} por visita</Text>
          </View>

          <View className="gap-1">
            <SectionTitle title="Qué incluye" />
            <List>
              <Row icon="calendar" title={`${plan.visits_per_cycle} visitas al mes`} subtitle={`${daysLabel(plan.days_per_week)}, tú eliges cuáles de lunes a viernes`} />
              <Row icon="clock" title={`${formatDuration(plan.visit_duration_minutes)} por visita`} />
              <Row icon="person" title="La misma persona en cada visita" subtitle="Personal de la empresa" />
              <Row icon="info" title="Ciclos de cuatro semanas" subtitle="Empieza con tu primera visita y se renueva el mismo día cuatro semanas después" />
            </List>
          </View>

          <View className="gap-3">
            <SectionTitle title="Condiciones" />
            <Text className="text-md leading-[24px] text-text">{plan.terms}</Text>
          </View>
        </>
      ) : null}
    </FlowScreen>
  );
}
