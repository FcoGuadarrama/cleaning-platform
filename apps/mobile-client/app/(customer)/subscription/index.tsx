import type { Schemas } from "@repo/api-client";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { api, errorCode, errorMessage } from "../../../src/api";
import { DateBlock } from "../../../src/DateBlock";
import { BOOKING_LABELS, BOOKING_TONES, businessDayInstant, formatDateTime, formatDuration, formatLongDay, formatMoney, formatRange, ymdOf } from "../../../src/format";
import { Icon } from "../../../src/icons";
import { Skeleton } from "../../../src/motion";
import { FlowScreen } from "../../../src/screen";
import { type Payment, paymentError, settle, TransferDetails } from "../../../src/payment";
import { currentCycle, formatTime, formatYmd, paidUntil, pendingRenewal, type Subscription, subscriptionStatus, weekdaysLabel } from "../../../src/subscriptions";
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

const longDay = (ymd: string) => formatLongDay(businessDayInstant(ymd));

/** Owner decision 2026-11-11: told on the last visit day, charged the next business day, cancellable until then. */
function RenewalNotice({ s }: { s: Subscription }) {
  if (!s.renewal_notice_on || !s.next_charge_on || ymdOf(new Date()) < s.renewal_notice_on) return null;
  const how = s.payment_method === "spei" ? "y te daremos los datos para tu transferencia" : "con tu tarjeta";
  return <Notice tone="primary" text={`Tu plan se renueva. El ${longDay(s.next_charge_on)} cobraremos ${formatMoney(s.price_minor, s.currency)} ${how}. Si no quieres continuar, cancélalo antes.`} />;
}

/** A held cycle (the first one, or a renewal): the transfer's details, or paying it now by card. */
function PendingPayment({ s, deadline, onPaid }: { s: Subscription; deadline: string | null; onPaid: () => void }) {
  const [pending, setPending] = useState<Payment | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void api.GET("/subscriptions/{subscription_id}/payment", { params: { path: { subscription_id: s.id } } }).then((r) => {
      setPending(r.data ?? null);
      if (r.error && errorCode(r.error) !== "not_found") setError(errorMessage(r.error));
    });
  }, [s.id, s.cycles.length]);

  async function payByCard() {
    setBusy(true);
    setError(null);
    const r = await api.POST("/subscriptions/{subscription_id}/checkout", { params: { path: { subscription_id: s.id } }, body: { method: "card" } });
    const result = r.data ? await settle(r.data) : { error: paymentError(r.error) };
    setBusy(false);
    if (result.payment) onPaid();
    else setError(result.error ?? null);
  }

  if (pending === undefined) return <SkeletonRows count={1} />;
  return (
    <View className="gap-3">
      {pending?.transfer ? <TransferDetails transfer={pending.transfer} payBy={deadline} /> : <Button label="Pagar ahora con tarjeta" busy={busy} onPress={payByCard} />}
      {error ? <Notice tone="danger" text={error} /> : null}
    </View>
  );
}

/** Owner decision 2026-11-11: no further charge, the paid visits stay, no refund. Confirmed in place, no dialog. */
function CancelSubscription({ s, onDone }: { s: Subscription; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const until = paidUntil(s);

  async function cancel() {
    setBusy(true);
    const r = await api.POST("/subscriptions/{subscription_id}/cancel", { params: { path: { subscription_id: s.id } } });
    setBusy(false);
    if (r.data) onDone();
    else setError(errorMessage(r.error));
  }

  if (!confirming)
    return (
      <List>
        <Row icon="sliders" title="Cancelar suscripción" onPress={() => setConfirming(true)} />
      </List>
    );
  return (
    <View className="gap-3">
      <SectionTitle title="¿Cancelar tu plan?" />
      <Text className="text-md text-text">
        No se te volverá a cobrar.{until ? ` Tus visitas ya pagadas siguen hasta el ${longDay(until)}.` : ""} No hay reembolso del ciclo en curso.
      </Text>
      <Button label="Sí, cancelar mi plan" variant="danger" busy={busy} onPress={cancel} />
      <Button label="No, mantenerlo" variant="outline" onPress={() => setConfirming(false)} />
      {error ? <Notice tone="danger" text={error} /> : null}
    </View>
  );
}

function SubscriptionDetail({ subscription: s, staffName, onChange }: { subscription: Subscription; staffName?: string; onChange: () => void }) {
  const cycle = currentCycle(s);
  const status = subscriptionStatus(s);
  const renewal = pendingRenewal(s);
  const until = paidUntil(s);
  return (
    <View className="gap-6">
      <View className="gap-2">
        <StatusChip label={status.label} tone={status.tone} />
        <Text accessibilityRole="header" className="text-[34px] font-semibold leading-[42px] tracking-[-1px] text-text">{s.plan_name}</Text>
        <Text className="text-md text-text">
          {formatMoney(s.price_minor, s.currency)} cada cuatro semanas · {s.visits_per_cycle} visitas de {formatDuration(s.visit_duration_minutes)}
        </Text>
      </View>

      {s.status === "held" && cycle?.hold_expires_at ? (
        <View className="gap-3">
          <Notice tone="warning" text={`Tu pago está pendiente. Si no se completa antes del ${formatDateTime(cycle.hold_expires_at)}, los horarios se liberan.`} />
          <PendingPayment s={s} deadline={cycle.hold_expires_at} onPaid={onChange} />
        </View>
      ) : null}
      {renewal ? (
        <View className="gap-3">
          <Notice tone="warning" text={`No hemos recibido el pago de tu renovación. Si no se paga antes del ${renewal.hold_expires_at ? formatDateTime(renewal.hold_expires_at) : "inicio del ciclo"}, tu plan termina.`} />
          <PendingPayment s={s} deadline={renewal.hold_expires_at} onPaid={onChange} />
        </View>
      ) : null}
      <RenewalNotice s={s} />
      {s.status === "active" && s.cancelled_at ? (
        <Notice tone="neutral" text={`Cancelaste tu plan. No habrá más cobros${until ? ` y tus visitas siguen hasta el ${longDay(until)}` : ""}.`} />
      ) : null}
      {s.status === "ended" ? (
        <Notice tone="neutral" text={s.end_reason === "unpaid" ? "Tu plan terminó porque no recibimos el pago de la renovación." : "Tu plan terminó."} />
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
        {s.next_charge_on ? <Row icon="card" title="Próximo cargo" value={`${formatYmd(s.next_charge_on)} · ${formatMoney(s.price_minor, s.currency)}`} /> : null}
        {s.renews_on ? <Row icon="layers" title="Siguiente ciclo" value={longDay(s.renews_on)} /> : null}
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

      {s.status === "active" && !s.cancelled_at ? <CancelSubscription s={s} onDone={onChange} /> : null}
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
          <SubscriptionDetail subscription={s} staffName={staffName(s.staff_id)} onChange={() => void subscriptions.refresh()} />
        </View>
      ))}
    </FlowScreen>
  );
}
