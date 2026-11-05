import { Text, View } from "react-native";
import { api } from "../../src/api";
import { businessDayInstant, formatLongDay, formatMoney } from "../../src/format";
import { Badge, Card, EmptyState, HeroPage, HeroText, IconTile, SectionHeader, StateView, type Tone } from "../../src/ui";
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
        <View className={`h-3.5 w-3.5 rounded-full ${reached ? "bg-primary" : "bg-border"}`} />
        {last ? null : <View className={`ml-1 h-1 flex-1 rounded-full ${reached ? "bg-primary/30" : "bg-border/60"}`} />}
      </View>
      <View className="gap-0.5 pr-2">
        <Text className="text-xs font-semibold text-text-muted">{label}</Text>
        <Text className="text-md font-extrabold text-text">{amount}</Text>
      </View>
    </View>
  );
}

export default function Earnings() {
  const summary = useResource(() => api.GET("/me/earnings"));
  const s = summary.data;
  return (
    <HeroPage
      onRefresh={summary.refresh}
      hero={
        <HeroText
          kicker={s ? `Semana del ${formatLongDay(businessDayInstant(s.week_start))}` : "Esta semana"}
          title={s ? formatMoney(s.earned_minor, s.currency) : "Ganancias"}
          subtitle={s ? "Generado en servicios completados" : undefined}
        />
      }
    >
      <StateView loading={summary.loading} error={summary.error} empty={!s} emptyIcon="wallet" emptyTitle="Sin datos de esta semana" onRetry={summary.refresh}>
        {s ? (
          <View className="gap-7">
            <Card className="gap-4 p-5">
              <Text className="text-md font-bold text-text">Estado de tu pago</Text>
              <View className="flex-row">
                <Stage label="Generado" amount={formatMoney(s.earned_minor, s.currency)} reached={s.earned_minor > 0} />
                <Stage label="Aprobado" amount={formatMoney(s.approved_minor, s.currency)} reached={s.approved_minor > 0} />
                <Stage label="Pagado" amount={formatMoney(s.paid_minor, s.currency)} reached={s.paid_minor > 0} last />
              </View>
            </Card>
            <View className="gap-3">
              <SectionHeader title="Servicios completados" detail={s.items.length ? `${s.items.length}` : undefined} />
              {s.items.length ? (
                s.items.map((e) => (
                  <Card key={e.id}>
                    <View className="flex-row items-center gap-3">
                      <IconTile icon="check" tone="success" size={44} />
                      <View className="flex-1 gap-1">
                        <Text className="text-md font-bold text-text">Servicio #{e.booking_id}</Text>
                        <Badge label={STATUS[e.status].label} tone={STATUS[e.status].tone} />
                      </View>
                      <Text className="text-md font-extrabold text-text">{formatMoney(e.amount_minor, e.currency)}</Text>
                    </View>
                  </Card>
                ))
              ) : (
                <EmptyState icon="wallet" title="Aún no hay servicios completados" text="Lo que generes esta semana aparecerá aquí." />
              )}
            </View>
          </View>
        ) : null}
      </StateView>
    </HeroPage>
  );
}
