import type { Schemas } from "@repo/api-client";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { api } from "../../../src/api";
import { DateBlock } from "../../../src/DateBlock";
import { BOOKING_LABELS, BOOKING_TONES, businessDayInstant, formatClock, formatDateTime, formatDuration, formatLongDay, formatMoney, formatRange } from "../../../src/format";
import { Icon } from "../../../src/icons";
import { Skeleton } from "../../../src/motion";
import { FlowScreen } from "../../../src/screen";
import { currentCycle, formatTime, formatYmd, type Subscription, SUBSCRIPTION_LABELS, SUBSCRIPTION_TONES, weekdaysLabel } from "../../../src/subscriptions";
import { Text } from "../../../src/text";
import { color } from "../../../src/theme";
import { Avatar, Button, EmptyState, List, Notice, Row, SectionTitle, SkeletonRows, StatusChip, StatusLine } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

function VisitRow({ visit }: { visit: Schemas["BookingOut"] }) {
  // A visit still awaiting payment lives only here; it opens once the cycle is paid.
  const open = visit.status !== "held";
  const content = (
    <>
      <DateBlock iso={visit.starts_at} size="sm" />
      <View className="flex-1 gap-1">
        <Text className="text-md font-semibold text-text">{formatRange(visit.starts_at, visit.ends_at)}</Text>
        <StatusLine label={BOOKING_LABELS[visit.status]} tone={BOOKING_TONES[visit.status]} />
      </View>
      {open ? <Icon name="arrow" size={20} color={color.text} strokeWidth={1.6} /> : null}
    </>
  );
  if (!open) return <View className="flex-row items-center gap-4 py-3">{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver visita del ${formatLongDay(visit.starts_at)}`}
      onPress={() => router.push({ pathname: "/(customer)/booking/[id]", params: { id: String(visit.id) } })}
      className="flex-row items-center gap-4 py-3 active:opacity-60"
    >
      {content}
    </Pressable>
  );
}

function SubscriptionDetail({ subscription: s, staffName }: { subscription: Subscription; staffName?: string }) {
  const cycle = currentCycle(s);
  return (
    <View className="gap-6">
      <View className="gap-2">
        <StatusChip label={SUBSCRIPTION_LABELS[s.status]} tone={SUBSCRIPTION_TONES[s.status]} />
        <Text accessibilityRole="header" className="text-[34px] font-semibold leading-[42px] tracking-[-1px] text-text">{s.plan_name}</Text>
        <Text className="text-md text-text">
          {formatMoney(s.price_minor, s.currency)} cada cuatro semanas · {s.visits_per_cycle} visitas de {formatDuration(s.visit_duration_minutes)}
        </Text>
      </View>

      {s.status === "held" && cycle?.hold_expires_at ? (
        <Notice tone="warning" text={`Tu pago está pendiente. Si no se completa antes de las ${formatClock(cycle.hold_expires_at)}, los horarios se liberan.`} />
      ) : null}

      <List>
        <Row icon="person" title="Profesional" trailing={
          <View className="flex-row items-center gap-2.5">
            <Avatar name={staffName ?? "?"} size="xs" />
            <Text className="text-md font-semibold text-text">{staffName ?? "Personal asignado"}</Text>
          </View>
        } />
        <Row icon="clock" title="Días y hora" value={`${weekdaysLabel(s.weekdays)} · ${formatTime(s.visit_start)}`} />
        <Row icon="pin" title="Domicilio" subtitle={s.address} />
        {cycle ? <Row icon="calendar" title="Ciclo actual" value={`${formatYmd(cycle.starts_on)} – ${formatYmd(cycle.ends_on)}`} /> : null}
        {s.renews_on ? <Row icon="layers" title="Se renueva" value={formatLongDay(businessDayInstant(s.renews_on))} /> : null}
      </List>

      {cycle ? (
        <View className="gap-1">
          <SectionTitle title="Visitas de este ciclo" />
          <List>
            {cycle.visits.map((v) => (
              <VisitRow key={v.id} visit={v} />
            ))}
          </List>
        </View>
      ) : null}

      <View className="gap-2">
        <SectionTitle title="Condiciones aceptadas" />
        <Text className="text-sm text-text-muted">Las aceptaste el {formatDateTime(s.terms_accepted_at)}; si el plan cambia, tu suscripción conserva estas condiciones y este precio.</Text>
        <Text className="text-md leading-[24px] text-text">{s.terms}</Text>
      </View>

      <List>
        <Row icon="sliders" title="Pausar o cancelar" soon />
      </List>
    </View>
  );
}

export default function MySubscription() {
  const subscriptions = useResource(() => api.GET("/subscriptions"));
  const staff = useResource(() => api.GET("/staff"));
  const list = subscriptions.data ?? [];
  const staffName = (id: number) => staff.data?.find((p) => p.id === id)?.display_name;

  return (
    <FlowScreen title="Mi suscripción" fallback="/(customer)/(tabs)/account">
      {subscriptions.error ? <Notice tone="danger" text={subscriptions.error} /> : null}
      {subscriptions.loading && !subscriptions.data ? (
        <View className="gap-3">
          <Skeleton className="h-7 w-28 rounded-md" />
          <Skeleton className="h-10 w-48" />
          <SkeletonRows count={4} />
        </View>
      ) : null}
      {subscriptions.data && !list.length ? (
        <EmptyState
          icon="layers"
          title="Aún no tienes un plan"
          text="Con un plan mensual la misma persona te visita los días que elijas."
          action={<Button label="Ver planes" onPress={() => router.replace("/(customer)/(tabs)/plans")} />}
        />
      ) : null}
      {list.map((s, i) => (
        <View key={s.id} className="gap-6">
          {i > 0 ? <View className="h-px bg-border" /> : null}
          <SubscriptionDetail subscription={s} staffName={staffName(s.staff_id)} />
        </View>
      ))}
    </FlowScreen>
  );
}
