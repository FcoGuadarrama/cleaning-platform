import type { Schemas } from "@repo/api-client";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, errorMessage } from "../../src/api";
import { useDaySlots, useNextSlots } from "../../src/availability";
import { formatAmount, formatClock, formatDuration, formatLongDay, formatMoney, formatRelativeDay, formatShortDay, nextBusinessDays } from "../../src/format";
import { Icon } from "../../src/icons";
import { HomeScene } from "../../src/illustrations";
import { Skeleton } from "../../src/motion";
import { FlowScreen } from "../../src/screen";
import { DayPicker, SlotGrid } from "../../src/SlotPicker";
import { Text } from "../../src/text";
import { color } from "../../src/theme";
import { Avatar, BRAND_NAME, Button, Callout, Field, Hairline, InfoNote, List, Notice, Overline, Row, SectionTitle, SkeletonRows, Soon, StateView, StatusDot } from "../../src/ui";
import { useResource } from "../../src/useResource";
import { serviceIcon } from "../../src/visits";

type Step = 1 | 2 | 3;
const TITLES: Record<Step, string> = { 1: "Elige profesional", 2: "Elige fecha y hora", 3: "Revisa tu reserva" };

function StepHeading({ step, title }: { step: Step; title: string }) {
  return (
    <View className="gap-2">
      <Overline>Paso {step} de 3</Overline>
      <Text accessibilityRole="header" className="text-2xl font-bold leading-[38px] tracking-[-1px] text-text">{title}</Text>
    </View>
  );
}

function NextSlotText({ slot }: { slot: { starts_at: string } | null | undefined }) {
  if (slot === undefined) return <Skeleton className="mt-1 h-3.5 w-36" />;
  if (slot === null) return <Text className="text-sm text-text-muted">Sin horarios esta semana</Text>;
  return (
    <Text className="text-sm text-text-muted">
      Próximo horario: {formatRelativeDay(slot.starts_at)}, {formatClock(slot.starts_at)}
    </Text>
  );
}

function Confirmed({ name, booking }: { name: string; booking: Schemas["BookingOut"] }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 justify-center gap-10 bg-background px-6" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}>
      <View className="items-center gap-5">
        <Animated.View entering={ZoomIn.springify().damping(14).stiffness(180)}>
          <StatusDot tone="success" size={88} />
        </Animated.View>
        <View className="items-center gap-2">
          <Text accessibilityRole="header" className="text-2xl font-bold tracking-[-1px] text-text">Visita confirmada</Text>
          <Text className="text-center text-md text-text-muted">
            {name} te visitará el {formatLongDay(booking.starts_at)}, a las {formatClock(booking.starts_at)}
          </Text>
        </View>
      </View>
      <View className="gap-3">
        <Button label="Ver mi visita" onPress={() => router.replace({ pathname: "/(customer)/booking/[id]", params: { id: String(booking.id) } })} />
        <Button label="Volver al inicio" variant="outline" onPress={() => router.replace("/(customer)/(tabs)")} />
      </View>
    </View>
  );
}

export default function Book() {
  const params = useLocalSearchParams<{ staffId?: string; offeringId?: string; day?: string; slot?: string }>();
  const days = nextBusinessDays(10);
  const [staffId, setStaffId] = useState<number | null>(params.staffId ? Number(params.staffId) : null);
  const [offeringId, setOfferingId] = useState<number | null>(params.offeringId ? Number(params.offeringId) : null);
  const [day, setDay] = useState(params.day && days.includes(params.day) ? params.day : days[0]!);
  const [slot, setSlot] = useState<string | null>(params.slot ?? null);
  const [step, setStep] = useState<Step>(params.staffId ? (params.slot ? 3 : 2) : 1);
  const [address, setAddress] = useState("");
  // The field stays open while the customer types; it collapses to a row only on blur or when prefilled.
  const [editingAddress, setEditingAddress] = useState(true);
  const [booking, setBooking] = useState<Schemas["BookingOut"] | null>(null);
  const [payment, setPayment] = useState<Schemas["PaymentOut"] | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offerings = useResource(() => api.GET("/offerings"));
  const staff = useResource(() => api.GET("/staff"));
  const bookings = useResource(() => api.GET("/bookings"));
  const offering = offerings.data?.find((o) => o.id === offeringId);
  const person = staff.data?.find((s) => s.id === staffId);
  const nextSlots = useNextSlots((staff.data ?? []).map((s) => s.id), offeringId ?? undefined);
  const daySlots = useDaySlots(staffId ?? 0, staffId ? (offeringId ?? undefined) : undefined, day);

  // Without a service from the previous screen, start with the first one offered.
  useEffect(() => {
    if (!offeringId && offerings.data?.[0]) setOfferingId(offerings.data[0].id);
  }, [offerings.data, offeringId]);

  // Prefill the address of the customer's latest visit; there is no address book yet.
  useEffect(() => {
    const last = [...(bookings.data ?? [])].sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
    if (last && !address) {
      setAddress(last.address);
      setEditingAddress(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings.data]);

  function go(next: Step) {
    // Changing an earlier choice drops a pending hold; it expires on its own.
    setBooking(null);
    setPayment(null);
    setError(null);
    setStep(next);
  }

  async function pay() {
    if (!offering || !slot || !staffId) return;
    setBusy(true);
    setError(null);
    let held = booking;
    if (!held) {
      const r = await api.POST("/bookings", { body: { staff_id: staffId, offering_id: offering.id, starts_at: slot, address: address.trim() } });
      if (!r.data) {
        setBusy(false);
        setSlot(null);
        setStep(2);
        setError(errorMessage(r.error));
        return;
      }
      held = r.data;
      setBooking(held);
    }
    let checkout = payment;
    if (!checkout) {
      const r = await api.POST("/bookings/{booking_id}/checkout", { params: { path: { booking_id: held.id } } });
      if (!r.data) {
        setBusy(false);
        setError(errorMessage(r.error));
        return;
      }
      checkout = r.data;
      setPayment(checkout);
    }
    const r = await api.POST("/payments/{payment_id}/sandbox-outcome", { params: { path: { payment_id: checkout.id } }, body: { outcome: "succeeded" } });
    setBusy(false);
    if (r.data?.status === "succeeded") setPaid(true);
    else setError(errorMessage(r.error));
  }

  if (booking && paid) return <Confirmed name={person?.display_name ?? ""} booking={booking} />;

  const back = step > 1 ? () => go((step - 1) as Step) : undefined;
  const addressOk = address.trim().length >= 5;
  const total = booking?.price_minor ?? offering?.price_minor;
  const currency = booking?.currency ?? offering?.currency ?? "MXN";

  if (step === 1)
    return (
      <FlowScreen title={TITLES[1]} fallback="/(customer)/(tabs)">
        <StepHeading step={1} title="¿Quién te visita?" />
        <View className="gap-1">
          <SectionTitle title="Servicio" />
          <StateView loading={offerings.loading} error={offerings.error} empty={!offerings.data?.length} emptyIcon="broom" emptyTitle="Aún no hay servicios disponibles" onRetry={offerings.refresh} skeleton={<SkeletonRows />}>
            <List>
              {(offerings.data ?? []).map((o, i) => (
                <Row
                  key={o.id}
                  icon={serviceIcon(i)}
                  title={o.name}
                  subtitle={`${formatDuration(o.duration_minutes)} · ${formatMoney(o.price_minor, o.currency)}`}
                  onPress={() => setOfferingId(o.id)}
                  trailing={<Icon name={o.id === offeringId ? "check" : "circle"} size={22} color={o.id === offeringId ? color.primary : color.border} strokeWidth={2} />}
                  accessibilityLabel={`${o.name}${o.id === offeringId ? ", elegido" : ""}`}
                />
              ))}
            </List>
          </StateView>
        </View>
        <View className="gap-1">
          <SectionTitle title="Profesional" />
          <StateView loading={staff.loading} error={staff.error} empty={!staff.data?.length} emptyIcon="person" emptyTitle="Por ahora no hay personal disponible" onRetry={staff.refresh} skeleton={<SkeletonRows count={3} />}>
            <List>
              {(staff.data ?? []).map((s) => (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Reservar con ${s.display_name}`}
                  onPress={() => {
                    setStaffId(s.id);
                    setSlot(null);
                    go(2);
                  }}
                  className="min-h-[76px] flex-row items-center gap-4 py-3 active:opacity-60"
                >
                  <Avatar name={s.display_name} size="md" />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-md font-semibold text-text">{s.display_name}</Text>
                    <NextSlotText slot={nextSlots[s.id]} />
                  </View>
                  <Icon name="arrow" size={20} color={color.text} strokeWidth={1.6} />
                </Pressable>
              ))}
            </List>
          </StateView>
        </View>
      </FlowScreen>
    );

  if (step === 2)
    return (
      <FlowScreen title={TITLES[2]} fallback="/(customer)/(tabs)" onBack={back} footer={<Button label="Continuar" disabled={!slot} onPress={() => go(3)} />}>
        <StepHeading step={2} title="¿Cuándo te visitamos?" />
        <List>
          <Row
            leading={<Avatar name={person?.display_name ?? "?"} size="sm" />}
            title={person?.display_name ?? "Profesional"}
            subtitle={offering ? `${offering.name} · ${formatDuration(offering.duration_minutes)}` : undefined}
            trailing={
              <Pressable accessibilityRole="button" onPress={() => go(1)} className="min-h-11 justify-center active:opacity-60">
                <Text className="text-md font-semibold text-primary">Cambiar</Text>
              </Pressable>
            }
          />
        </List>
        {error ? <Notice tone="danger" text={error} /> : null}
        <DayPicker
          days={days}
          selected={day}
          onSelect={(d) => {
            setDay(d);
            setSlot(null);
          }}
        />
        <SlotGrid slots={daySlots} selected={slot} onSelect={setSlot} />
      </FlowScreen>
    );

  return (
    <FlowScreen
      title={TITLES[3]}
      fallback="/(customer)/(tabs)"
      onBack={back}
      footer={<Button label={total !== undefined ? `Pagar ${formatMoney(total, currency)}` : "Pagar"} busy={busy} disabled={!offering || !slot || !addressOk} onPress={pay} />}
    >
      <StepHeading step={3} title={`Todo listo para\nrecibir a ${BRAND_NAME}.`} />

      <View className="flex-row items-center gap-4">
        <View className="h-[92px] w-[44%] overflow-hidden rounded-md">
          <HomeScene />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-lg font-semibold leading-[24px] text-text">{offering?.name ?? " "}</Text>
          {offering ? <Text className="text-sm text-text">{formatDuration(offering.duration_minutes)} · Visita única</Text> : null}
        </View>
      </View>

      <View className="gap-2">
        <Overline>Tu visita</Overline>
        <List>
          <Row icon="calendar" title="Fecha" value={slot ? `${formatShortDay(slot)} · ${formatClock(slot)}` : "—"} />
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
          {editingAddress || !addressOk ? (
            <View className="py-3">
              <Field
                label="Domicilio"
                icon="home"
                placeholder="Calle, número y colonia"
                value={address}
                onChangeText={setAddress}
                onBlur={() => addressOk && setEditingAddress(false)}
                autoComplete="street-address"
                textContentType="fullStreetAddress"
              />
            </View>
          ) : (
            <Row
              icon="home"
              title="Domicilio"
              trailing={
                <View className="max-w-[60%] flex-row items-center gap-3">
                  <Text numberOfLines={1} className="shrink text-md text-text">{address}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Editar domicilio" onPress={() => setEditingAddress(true)} className="min-h-11 justify-center active:opacity-60">
                    <Text className="border-b border-primary text-md font-semibold text-primary">Editar</Text>
                  </Pressable>
                </View>
              }
            />
          )}
        </List>
      </View>

      <View className="gap-3">
        <SectionTitle title="Antes de empezar" />
        <Callout icon="spray">
          <Text className="text-md font-semibold text-text">Tú proporcionas los productos y herramientas.</Text>
        </Callout>
        <View accessibilityLabel="Agregar kit de limpieza, próximamente" className="min-h-11 flex-row items-center gap-3">
          <Icon name="square" size={24} color={color.border} strokeWidth={1.8} />
          <Text className="flex-1 text-md text-text-muted">Agregar kit de limpieza</Text>
          <Soon />
        </View>
      </View>

      <View className="gap-2">
        <Hairline />
        {offering ? (
          <View className="flex-row justify-between">
            <Text className="text-md text-text">Servicio</Text>
            <Text className="text-md text-text">{formatAmount(offering.price_minor, offering.currency)}</Text>
          </View>
        ) : null}
        <View className="flex-row items-baseline justify-between pt-1">
          <Text className="text-xl font-semibold text-text">Total</Text>
          <Text className="text-xl font-semibold text-text">{total !== undefined ? formatMoney(total, currency) : "—"}</Text>
        </View>
      </View>

      <InfoNote text="Puedes cambiar la fecha sin cargo con al menos 24 h de anticipación." />

      <List>
        <Row icon="card" title="Método de pago" subtitle="Pago de prueba (sandbox): no se hace ningún cobro real" soon />
      </List>

      {error ? <Notice tone="danger" text={error} /> : null}
    </FlowScreen>
  );
}
