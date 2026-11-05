import { Text, View } from "react-native";
import { api } from "../../src/api";
import { businessDayInstant, formatLongDay, formatMoney } from "../../src/format";
import { Badge, Group, Page, Section, StateView, type Tone } from "../../src/ui";
import { useResource } from "../../src/useResource";

const STATUS: Record<"earned" | "approved" | "paid", { label: string; tone: Tone }> = {
  earned: { label: "Generado", tone: "neutral" },
  approved: { label: "Aprobado", tone: "primary" },
  paid: { label: "Pagado", tone: "success" },
};

/** Earning → approval → payout is a sequence; each stage shows its own amount. */
function Stage({ label, amount, reached, last }: { label: string; amount: string; reached: boolean; last?: boolean }) {
  return (
    <View className="flex-1 gap-2">
      <View className="flex-row items-center">
        <View className={`h-3 w-3 rounded-full ${reached ? "bg-primary" : "bg-border"}`} />
        {last ? null : <View className={`ml-1 h-0.5 flex-1 rounded-full ${reached ? "bg-primary/40" : "bg-border"}`} />}
      </View>
      <View className="gap-0.5 pr-2">
        <Text className="text-xs text-text-muted">{label}</Text>
        <Text className="text-md font-semibold text-text">{amount}</Text>
      </View>
    </View>
  );
}

export default function Earnings() {
  const summary = useResource(() => api.GET("/me/earnings"));
  const s = summary.data;
  return (
    <Page title="Ganancias" subtitle={s ? `Semana del ${formatLongDay(businessDayInstant(s.week_start))}` : undefined} onRefresh={summary.refresh}>
      <StateView loading={summary.loading} error={summary.error} empty={!s} emptyIcon="wallet" emptyTitle="Sin datos de esta semana" onRetry={summary.refresh}>
        {s ? (
          <>
            <View className="gap-5 rounded-xl bg-surface-raised p-5">
              <View className="gap-1">
                <Text className="text-sm text-text-muted">Generado esta semana</Text>
                <Text className="text-2xl font-bold tracking-[-0.6px] text-text">{formatMoney(s.earned_minor, s.currency)}</Text>
              </View>
              <View className="flex-row">
                <Stage label="Generado" amount={formatMoney(s.earned_minor, s.currency)} reached={s.earned_minor > 0} />
                <Stage label="Aprobado" amount={formatMoney(s.approved_minor, s.currency)} reached={s.approved_minor > 0} />
                <Stage label="Pagado" amount={formatMoney(s.paid_minor, s.currency)} reached={s.paid_minor > 0} last />
              </View>
            </View>
            <Section title="Servicios completados">
              {s.items.length ? (
                <Group>
                  {s.items.map((e) => (
                    <View key={e.id} className="min-h-[56px] flex-row items-center gap-3 px-4 py-3">
                      <Text className="flex-1 text-md text-text">Servicio #{e.booking_id}</Text>
                      <Badge label={STATUS[e.status].label} tone={STATUS[e.status].tone} />
                      <Text className="w-24 text-right text-md font-semibold text-text">{formatMoney(e.amount_minor, e.currency)}</Text>
                    </View>
                  ))}
                </Group>
              ) : (
                <Text className="px-1 text-sm text-text-muted">Aún no hay servicios completados esta semana.</Text>
              )}
            </Section>
          </>
        ) : null}
      </StateView>
    </Page>
  );
}
