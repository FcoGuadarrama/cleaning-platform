import { View } from "react-native";
import { api } from "../../../src/api";
import { Rise } from "../../../src/motion";
import { PlanCard } from "../../../src/PlanCard";
import { FlowScreen } from "../../../src/screen";
import { Text } from "../../../src/text";
import { Notice, SkeletonCard, StateView } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

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
