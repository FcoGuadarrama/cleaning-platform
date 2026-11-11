import type { Schemas } from "@repo/api-client";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type Address, shortAddress, useAddresses } from "../../src/addresses";
import { api, errorMessage } from "../../src/api";
import { businessDayInstant, formatDuration, formatLongDay, formatMoney } from "../../src/format";
import { Icon } from "../../src/icons";
import { IdempotencyKeys } from "../../src/idempotency";
import { type Payment, type PaymentMethod, PaymentMethodPicker, paymentError, settle, TransferDetails } from "../../src/payment";
import { daysLabel } from "../../src/plans";
import { FlowScreen } from "../../src/screen";
import { DayPicker, SlotGrid } from "../../src/SlotPicker";
import { firstVisitOptions, formatTime, formatYmd, subscriptionError, WEEKDAYS, WEEKDAYS_SHORT, weekdaysLabel } from "../../src/subscriptions";
import { Text } from "../../src/text";
import { color } from "../../src/theme";
import { Avatar, Button, EmptyState, Hairline, List, Notice, Overline, Row, SectionTitle, SkeletonRows, StateView, StatusDot } from "../../src/ui";
import { useResource } from "../../src/useResource";

type Step = 1 | 2 | 3;
type Schedule = Schemas["SubscriptionScheduleOut"];
const TITLES: Record<Step, string> = { 1: "Elige profesional", 2: "Elige días y horario", 3: "Revisa tu plan" };

function StepHeading({ step, title }: { step: Step; title: string }) {
  return (
    <View className="gap-2">
      <Overline>Paso {step} de 3</Overline>
      <Text accessibilityRole="header" className="text-2xl font-bold leading-[38px] tracking-[-1px] text-text">{title}</Text>
    </View>
  );
}

function Choice({ on }: { on: boolean }) {
  return <Icon name={on ? "check" : "circle"} size={22} color={on ? color.primary : color.border} strokeWidth={2} />;
}

/** Mon–Fri toggles. With one day per week a tap swaps the day; otherwise a full selection ignores new days. */
function WeekdayPicker({ selected, max, onChange }: { selected: number[]; max: number; onChange: (days: number[]) => void }) {
  function toggle(day: number) {
    if (selected.includes(day)) onChange(selected.filter((d) => d !== day));
    else if (max === 1) onChange([day]);
    else if (selected.length < max) onChange([...selected, day].sort());
  }
  return (
    <View className="flex-row gap-1.5">
      {WEEKDAYS_SHORT.map((label, day) => {
        const on = selected.includes(day);
        const blocked = !on && max > 1 && selected.length >= max;
        return (
          <Pressable
            key={label}
            accessibilityRole="checkbox"
            accessibilityLabel={WEEKDAYS[day]}
            accessibilityState={{ checked: on, disabled: blocked }}
            onPress={() => toggle(day)}
            className={`h-14 flex-1 items-center justify-center rounded-md active:opacity-80 ${on ? "bg-primary" : "bg-primary-soft"} ${blocked ? "opacity-50" : ""}`}
          >
            <Text className={`text-md font-semibold ${on ? "text-on-primary" : "text-text"}`}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function AddressChoices({ addresses, selected, onSelect }: { addresses: Address[]; selected: number | null; onSelect: (id: number) => void }) {
  return (
    <List>
      {addresses.map((a) => (
        <Row
          key={a.id}
          icon="pin"
          title={a.label}
          subtitle={shortAddress(a)}
          onPress={() => onSelect(a.id)}
          trailing={<Choice on={a.id === selected} />}
          accessibilityLabel={`${a.label}${a.id === selected ? ", elegido" : ""}`}
        />
      ))}
      <Row
        leading={<Icon name="plus" size={24} color={color.primary} strokeWidth={1.8} />}
        title="Agregar domicilio"
        onPress={() => router.push({ pathname: "/(customer)/addresses/[id]", params: { id: "new" } })}
      />
    </List>
  );
}

/** Every included date, two per row, so the customer sees the whole cycle before paying. */
function VisitDates({ dates, time }: { dates: string[]; time: string }) {
  const rows: string[][] = [];
  for (let i = 0; i < dates.length; i += 2) rows.push(dates.slice(i, i + 2));
  return (
    <View className="gap-2" accessibilityLabel={`Visitas incluidas: ${dates.map((d) => formatLongDay(businessDayInstant(d))).join(", ")}, a las ${formatTime(time)}`}>
      {rows.map((row) => (
        <View key={row[0]} className="flex-row gap-2">
          {row.map((d) => (
            <View key={d} className="flex-1 flex-row items-center gap-2 rounded-md bg-primary-soft px-3 py-2.5">
              <Icon name="calendar" size={18} color={color.text} strokeWidth={1.6} />
              <Text className="text-md text-text">{formatYmd(d)}</Text>
            </View>
          ))}
          {row.length < 2 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}

function Activated({ name, subscription }: { name: string; subscription: Schemas["SubscriptionOut"] }) {
  const insets = useSafeAreaInsets();
  const first = subscription.cycles[0]?.visits[0];
  return (
    <View className="flex-1 justify-center gap-10 bg-background px-6" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}>
      <View className="items-center gap-5">
        <Animated.View entering={ZoomIn.springify().damping(14).stiffness(180)}>
          <StatusDot tone="success" size={88} />
        </Animated.View>
        <View className="items-center gap-2">
          <Text accessibilityRole="header" className="text-2xl font-bold tracking-[-1px] text-text">Tu plan está activo</Text>
          <Text className="text-center text-md text-text-muted">
            {first ? `${name} te visitará por primera vez el ${formatLongDay(first.starts_at)}, a las ${formatTime(subscription.visit_start)}.` : ""}
          </Text>
        </View>
      </View>
      <View className="gap-3">
        <Button label="Ver mi suscripción" onPress={() => router.replace("/(customer)/subscription")} />
        <Button label="Volver al inicio" variant="outline" onPress={() => router.replace("/(customer)/(tabs)")} />
      </View>
    </View>
  );
}

/** SPEI: every visit of the first cycle is held while an agent confirms the transfer. */
function AwaitingTransfer({ subscription, payment }: { subscription: Schemas["SubscriptionOut"]; payment: Payment }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 gap-8 bg-background px-6" style={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }}>
      <View className="gap-2">
        <Text accessibilityRole="header" className="text-2xl font-bold tracking-[-1px] text-text">Te apartamos tu plan</Text>
        <Text className="text-md text-text-muted">Haz la transferencia y activamos tu plan en cuanto la confirmemos.</Text>
      </View>
      {payment.transfer ? <TransferDetails transfer={payment.transfer} payBy={subscription.cycles[0]?.hold_expires_at} /> : null}
      <View className="gap-3">
        <Button label="Ver mi suscripción" onPress={() => router.replace("/(customer)/subscription")} />
        <Button label="Volver al inicio" variant="outline" onPress={() => router.replace("/(customer)/(tabs)")} />
      </View>
    </View>
  );
}

export default function Subscribe() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const plans = useResource(() => api.GET("/subscription-plans"));
  const staff = useResource(() => api.GET("/staff"));
  const addresses = useAddresses();
  const plan = plans.data?.find((p) => p.id === Number(planId));

  const [step, setStep] = useState<Step>(1);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startsOn, setStartsOn] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [choosingAddress, setChoosingAddress] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [subscription, setSubscription] = useState<Schemas["SubscriptionOut"] | null>(null);
  const [holdKeys] = useState(() => new IdempotencyKeys());
  const [payment, setPayment] = useState<Payment | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const knownAddressIds = useRef<Set<number> | null>(null);

  const person = staff.data?.find((s) => s.id === staffId);
  const daysComplete = !!plan && weekdays.length === plan.days_per_week;
  const startOptions = daysComplete ? firstVisitOptions(weekdays) : [];

  // Keep the first visit on one of the chosen weekdays; default to the earliest option.
  useEffect(() => {
    if (!startOptions.length) setStartsOn(null);
    else if (!startsOn || !startOptions.includes(startsOn)) setStartsOn(startOptions[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startOptions.join(",")]);

  // Times free on every visit of the cycle for the current choice.
  useEffect(() => {
    if (!plan || !staffId || !startsOn || !daysComplete) {
      setSchedule(null);
      return;
    }
    let alive = true;
    setSchedule(null);
    setScheduleError(null);
    void api
      .GET("/subscription-plans/{plan_id}/schedule", { params: { path: { plan_id: plan.id }, query: { staff_id: staffId, starts_on: startsOn, weekdays } } })
      .then((r) => {
        if (!alive) return;
        if (r.data) setSchedule(r.data);
        else setScheduleError(subscriptionError(r.error) ?? errorMessage(r.error));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, staffId, startsOn, weekdays.join(","), daysComplete, scheduleVersion]);

  // Start on the default address; an address added from this screen is selected when the form closes.
  useEffect(() => {
    const list = addresses.data;
    if (!list) return;
    const known = knownAddressIds.current;
    const added = known ? list.find((a) => !known.has(a.id)) : undefined;
    knownAddressIds.current = new Set(list.map((a) => a.id));
    if (added) chooseAddress(added.id);
    else if (!list.some((a) => a.id === addressId)) chooseAddress(list.find((a) => a.is_default)?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.data]);

  /** Any change to an earlier choice drops a pending hold; it lapses on its own. */
  function dropHold() {
    setSubscription(null);
    setPayment(null);
    holdKeys.reset();
  }

  function chooseAddress(id: number | null) {
    if (id !== addressId) dropHold();
    setAddressId(id);
    setChoosingAddress(false);
  }

  function go(next: Step) {
    dropHold();
    setError(null);
    setStep(next);
  }

  /** A lapsed or lost hold sends the customer back to pick a time again; the error stays visible there. */
  function backToTimes() {
    dropHold();
    setTime(null);
    setScheduleVersion((v) => v + 1);
    setStep(2);
  }

  async function pay() {
    if (!plan || !staffId || !startsOn || !time || !addressId || !accepted) return;
    setBusy(true);
    setError(null);
    let held = subscription;
    if (!held) {
      const body = { plan_id: plan.id, staff_id: staffId, address_id: addressId, weekdays, starts_on: startsOn, visit_start: time, accept_terms: true as const };
      const r = await api.POST("/subscriptions", { body, params: { header: { "idempotency-key": holdKeys.for(body) } } });
      if (!r.data) {
        setBusy(false);
        const message = subscriptionError(r.error) ?? errorMessage(r.error);
        if ((r.error as { code?: string } | undefined)?.code === "visits_unavailable") backToTimes();
        setError(message);
        return;
      }
      held = r.data;
      setSubscription(held);
    }
    let checkout = payment;
    if (!checkout || checkout.method !== method) {
      const r = await api.POST("/subscriptions/{subscription_id}/checkout", { params: { path: { subscription_id: held.id } }, body: { method } });
      if (!r.data) {
        setBusy(false);
        if ((r.error as { code?: string } | undefined)?.code === "hold_expired") backToTimes();
        setError(subscriptionError(r.error) ?? paymentError(r.error));
        return;
      }
      checkout = r.data;
      setPayment(checkout);
    }
    const result = await settle(checkout);
    if (!result.payment) {
      setBusy(false);
      setError(result.error ?? null);
      return;
    }
    const confirmed = await api.GET("/subscriptions/{subscription_id}", { params: { path: { subscription_id: held.id } } });
    setBusy(false);
    if (result.payment.method === "spei" && confirmed.data) {
      setSubscription(confirmed.data);
      setPaid(true);
    } else if (confirmed.data?.status === "active") {
      setSubscription(confirmed.data);
      setPaid(true);
    } else {
      backToTimes();
      setError("El pago llegó después de que venció el apartado. No se activó el plan; vuelve a elegir el horario.");
    }
  }

  if (subscription && paid && payment?.method === "spei") return <AwaitingTransfer subscription={subscription} payment={payment} />;
  if (subscription && paid) return <Activated name={person?.display_name ?? ""} subscription={subscription} />;

  if (!plan)
    return (
      <FlowScreen title="Contratar plan" fallback="/(customer)/(tabs)/plans">
        {plans.error ? <Notice tone="danger" text={plans.error} /> : null}
        {plans.loading ? <SkeletonRows count={3} /> : null}
        {!plans.loading && !plans.error ? (
          <EmptyState icon="layers" title="Este plan ya no está disponible" text="Puede que lo hayan actualizado. Regresa para ver los planes vigentes." />
        ) : null}
      </FlowScreen>
    );

  const planRow = (
    <Row icon="layers" title={plan.name} subtitle={`${daysLabel(plan.days_per_week)} · ${formatDuration(plan.visit_duration_minutes)} por visita · ${formatMoney(plan.price_minor, plan.currency)} al mes`} />
  );

  if (step === 1)
    return (
      <FlowScreen title={TITLES[1]} fallback={{ pathname: "/(customer)/plans/[id]", params: { id: String(plan.id) } }}>
        <StepHeading step={1} title="¿Quién te visitará cada semana?" />
        <List>{planRow}</List>
        <View className="gap-1">
          <SectionTitle title="Profesional" />
          <Text className="text-sm text-text-muted">Será la misma persona en todas las visitas del plan.</Text>
          <StateView loading={staff.loading} error={staff.error} empty={!staff.data?.length} emptyIcon="person" emptyTitle="Por ahora no hay personal disponible" onRetry={staff.refresh} skeleton={<SkeletonRows count={3} />}>
            <List>
              {(staff.data ?? []).map((s) => (
                <Row
                  key={s.id}
                  leading={<Avatar name={s.display_name} size="md" />}
                  title={s.display_name}
                  subtitle={s.bio || undefined}
                  accessibilityLabel={`Elegir a ${s.display_name}`}
                  onPress={() => {
                    if (s.id !== staffId) setTime(null);
                    setStaffId(s.id);
                    go(2);
                  }}
                />
              ))}
            </List>
          </StateView>
        </View>
      </FlowScreen>
    );

  if (step === 2) {
    const times = schedule?.start_times.map((t) => ({ starts_at: t })) ?? null;
    return (
      <FlowScreen title={TITLES[2]} fallback="/(customer)/(tabs)/plans" onBack={() => go(1)} footer={<Button label="Continuar" disabled={!time || !schedule} onPress={() => go(3)} />}>
        <StepHeading step={2} title="¿Qué días te visitamos?" />
        <List>
          <Row
            leading={<Avatar name={person?.display_name ?? "?"} size="sm" />}
            title={person?.display_name ?? "Profesional"}
            subtitle={plan.name}
            trailing={
              <Pressable accessibilityRole="button" accessibilityLabel="Cambiar profesional" onPress={() => go(1)} className="min-h-11 justify-center active:opacity-60">
                <Text className="text-md font-semibold text-primary">Cambiar</Text>
              </Pressable>
            }
          />
        </List>
        {error ? <Notice tone="danger" text={error} /> : null}

        <View className="gap-3">
          <SectionTitle title={plan.days_per_week === 1 ? "Elige el día" : `Elige ${plan.days_per_week} días`} />
          <WeekdayPicker
            selected={weekdays}
            max={plan.days_per_week}
            onChange={(days) => {
              setWeekdays(days);
              setTime(null);
            }}
          />
          <Text className="text-sm text-text-muted">
            {daysComplete
              ? `${weekdaysLabel(weekdays)} de cada semana: ${plan.visits_per_cycle} visitas en cuatro semanas.`
              : `Elegiste ${weekdays.length} de ${plan.days_per_week}.`}
          </Text>
        </View>

        {daysComplete && startsOn ? (
          <View className="gap-3">
            <SectionTitle title="Primera visita" />
            <Text className="text-sm text-text-muted">Tu ciclo de cuatro semanas empieza ese día.</Text>
            <DayPicker
              days={startOptions}
              selected={startsOn}
              onSelect={(d) => {
                setStartsOn(d);
                setTime(null);
              }}
            />
          </View>
        ) : null}

        {daysComplete && startsOn ? (
          <View className="gap-3">
            <SectionTitle title="Horario" />
            <Text className="text-sm text-text-muted">Solo mostramos horarios libres en todas tus visitas del ciclo.</Text>
            {scheduleError ? (
              <Notice tone="danger" text={scheduleError} />
            ) : (
              <SlotGrid slots={times} selected={time} onSelect={setTime} format={formatTime} empty="No hay un horario libre en todas las visitas. Prueba con otra primera visita, otros días u otra persona." />
            )}
          </View>
        ) : null}
      </FlowScreen>
    );
  }

  const address = addresses.data?.find((a) => a.id === addressId);
  const ready = !!schedule && !!time && !!address && accepted;
  return (
    <FlowScreen
      title={TITLES[3]}
      fallback="/(customer)/(tabs)/plans"
      onBack={() => go(2)}
      footer={
        <>
          {!accepted ? <Text className="text-center text-sm text-text-muted">Acepta las condiciones para continuar</Text> : null}
          <Button label={method === "spei" ? "Pagar por transferencia" : `Pagar ${formatMoney(plan.price_minor, plan.currency)}`} busy={busy} disabled={!ready} onPress={pay} />
        </>
      }
    >
      <StepHeading step={3} title="Revisa tu plan antes de pagar" />

      <View className="gap-2">
        <Overline>Tu plan</Overline>
        <List>
          {planRow}
          <Row
            icon="person"
            title="Profesional"
            trailing={
              <View className="flex-row items-center gap-2.5">
                <Avatar name={person?.display_name ?? "?"} size="xs" />
                <Text className="text-md font-semibold text-text">{person?.display_name ?? ""}</Text>
              </View>
            }
          />
          <Row icon="clock" title="Días y hora" value={time ? `${weekdaysLabel(weekdays)} · ${formatTime(time)}` : "—"} />
          <Row
            icon="home"
            title={address ? `Domicilio · ${address.label}` : "Domicilio"}
            subtitle={address ? shortAddress(address) : "Agrega dónde serán las visitas"}
            trailing={
              addresses.data?.length ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Cambiar domicilio" onPress={() => setChoosingAddress((v) => !v)} className="min-h-11 justify-center active:opacity-60">
                  <Text className="border-b border-primary text-md font-semibold text-primary">Cambiar</Text>
                </Pressable>
              ) : undefined
            }
          />
        </List>
        {addresses.loading && !addresses.data ? <SkeletonRows count={1} /> : null}
        {addresses.error ? <Notice tone="danger" text={addresses.error} /> : null}
        {choosingAddress || (addresses.data && !addresses.data.length) ? (
          <AddressChoices addresses={addresses.data ?? []} selected={addressId} onSelect={chooseAddress} />
        ) : null}
      </View>

      {schedule && time ? (
        <View className="gap-3">
          <SectionTitle title={`Tus ${schedule.visit_dates.length} visitas`} />
          <Text className="text-sm text-text-muted">
            Del {formatYmd(schedule.starts_on)} al {formatYmd(schedule.ends_on)}, a las {formatTime(time)}. El día de tu última visita te avisamos que renovaremos el cobro al siguiente día hábil; puedes cancelar antes.
          </Text>
          <VisitDates dates={schedule.visit_dates} time={time} />
        </View>
      ) : null}

      <View className="gap-3">
        <SectionTitle title="Condiciones" />
        <Text className="text-md leading-[24px] text-text">{plan.terms}</Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          onPress={() => {
            setAccepted((v) => !v);
          }}
          className="min-h-12 flex-row items-center gap-3 active:opacity-70"
        >
          <Icon name={accepted ? "check" : "square"} size={24} color={accepted ? color.primary : color.border} strokeWidth={2} />
          <Text className="flex-1 text-md text-text">Acepto las condiciones y el precio de este plan</Text>
        </Pressable>
      </View>

      <View className="gap-2">
        <Hairline />
        <View className="flex-row items-baseline justify-between pt-1">
          <Text className="text-xl font-semibold text-text">Total del ciclo</Text>
          <Text className="text-xl font-semibold text-text">{formatMoney(plan.price_minor, plan.currency)}</Text>
        </View>
        <Text className="text-sm text-text-muted">Cubre las {plan.visits_per_cycle} visitas de estas cuatro semanas.</Text>
      </View>

      <View className="gap-1">
        <SectionTitle title="Método de pago" />
        <PaymentMethodPicker value={method} onChange={setMethod} />
        <Text className="text-sm text-text-muted">Las renovaciones se cobran con el mismo método.</Text>
      </View>

      {error ? <Notice tone="danger" text={error} /> : null}
    </FlowScreen>
  );
}
