import { View } from "react-native";
import { api } from "../../../src/api";
import { businessDayInstant, formatAmount, formatLongDay, formatMoney } from "../../../src/format";
import { Screen } from "../../../src/screen";
import { Text } from "../../../src/text";
import { Card, EmptyState, LargeTitle, List, Row, SectionTitle, StateView } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

const STATUS: Record<"earned" | "approved" | "paid", string> = { earned: "Por aprobar", approved: "Aprobado", paid: "Pagado" };

/** Earning → approval → payout is a sequence; each stage shows its own amount. */
function Stage({ label, amount, reached, last }: { label: string; amount: string; reached: boolean; last?: boolean }) {
  return (
    <View className="flex-1 gap-2">
      <View className="flex-row items-center">
        <View className={`h-3 w-3 rounded-full ${reached ? "bg-primary" : "bg-border"}`} />
        {last ? null : <View className={`ml-1 h-0.5 flex-1 ${reached ? "bg-primary" : "bg-border"}`} />}
      </View>
      <View className="gap-0.5 pr-2">
        <Text className="text-sm text-text">{label}</Text>
        <Text className="text-md font-semibold text-text">{amount}</Text>
      </View>
    </View>
  );
}

export default function Earnings() {
  const summary = useResource(() => api.GET("/me/earnings"));
  const s = summary.data;
  // Each amount sits in exactly one stage, so the week's total is their sum.
  const total = s ? s.earned_minor + s.approved_minor + s.paid_minor : 0;
  return (
    <Screen onRefresh={summary.refresh}>
      <LargeTitle overline={s ? `Semana del ${formatLongDay(businessDayInstant(s.week_start))}` : "Esta semana"} title="Ganancias" />
      <StateView loading={summary.loading} error={summary.error} empty={!s} emptyIcon="card" emptyTitle="Sin datos de esta semana" onRetry={summary.refresh}>
        {s ? (
          <View className="gap-7">
            <Card className="gap-5">
              <View className="gap-0.5">
                <Text className="text-sm text-text">Generado en servicios completados</Text>
                <Text className="text-[34px] font-semibold leading-[42px] tracking-[-1px] text-text">{formatMoney(total, s.currency)}</Text>
              </View>
              <View className="flex-row">
                <Stage label="Por aprobar" amount={formatAmount(s.earned_minor, s.currency)} reached={total > 0} />
                <Stage label="Aprobado" amount={formatAmount(s.approved_minor, s.currency)} reached={s.approved_minor + s.paid_minor > 0} />
                <Stage label="Pagado" amount={formatAmount(s.paid_minor, s.currency)} reached={s.paid_minor > 0} last />
              </View>
            </Card>
            <View className="gap-1">
              <SectionTitle title="Servicios completados" />
              {s.items.length ? (
                <List>
                  {s.items.map((e) => (
                    <Row key={e.id} icon="check" title={`Servicio #${e.booking_id}`} subtitle={STATUS[e.status]} value={formatAmount(e.amount_minor, e.currency)} />
                  ))}
                </List>
              ) : (
                <EmptyState icon="card" title="Aún no hay servicios completados" text="Lo que generes esta semana aparecerá aquí." />
              )}
            </View>
          </View>
        ) : null}
      </StateView>
    </Screen>
  );
}
