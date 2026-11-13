import type { Schemas } from "@repo/api-client";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type Address, shortAddress, useAddresses } from "../../src/addresses";
import { api, errorCode, errorMessage } from "../../src/api";
import { useDaySlots, useNextSlots } from "../../src/availability";
import { formatAmount, formatClock, formatDuration, formatLongDay, formatMoney, formatRelativeDay, formatShortDay, nextBusinessDays } from "../../src/format";
import { Icon } from "../../src/icons";
import { IdempotencyKeys } from "../../src/idempotency";
import { type Payment, type PaymentMethod, PaymentMethodPicker, paymentError, settle, TransferDetails } from "../../src/payment";
import { HomeScene } from "../../src/illustrations";
import { Skeleton } from "../../src/motion";
import { FlowScreen } from "../../src/screen";
import { DayPicker, SlotGrid } from "../../src/SlotPicker";
import { Text } from "../../src/text";
import { color } from "../../src/theme";
import { Avatar, BRAND_NAME, Button, Callout, Hairline, InfoNote, List, Notice, Overline, Row, SectionTitle, SkeletonRows, Soon, StateView, StatusDot } from "../../src/ui";
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

function AddressRow({ address, onChange }: { address?: Address; onChange?: () => void }) {
  return (
    <Row
      icon="home"
      title={address ? `Domicilio · ${address.label}` : "Domicilio"}
      subtitle={address ? shortAddress(address) : "Agrega dónde será la visita"}
      trailing={
        onChange ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Cambiar domicilio" onPress={onChange} className="min-h-11 justify-center active:opacity-60">
            <Text className="border-b border-primary text-md font-semibold text-primary">Cambiar</Text>
          </Pressable>
        ) : undefined
      }
    />
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
          trailing={<Icon name={a.id === selected ? "check" : "circle"} size={22} color={a.id === selected ? color.primary : color.border} strokeWidth={2} />}
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

function NextSlotText({ slot }: { slot: { starts_at: string } | null | undefined }) {
  if (slot === undefined) return <Skeleton className="mt-1 h-3.5 w-36" />;
  if (slot === null) return <Text className="text-sm text-text-muted">Sin horarios esta semana</Text>;
  return (
    <Text className="text-sm text-text-muted">
      Próximo horario: {formatRelativeDay(slot.starts_at)}, {formatClock(slot.starts_at)}
    </Text>
  );
}

/** SPEI: the visit is held while an agent confirms the transfer. */
function AwaitingTransfer({ booking, payment }: { booking: Schemas["BookingOut"]; payment: Payment }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 gap-8 bg-background px-6" style={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }}>
      <View className="gap-2">
        <Text accessibilityRole="header" className="text-2xl font-bold tracking-[-1px] text-text">Te apartamos tu visita</Text>
        <Text className="text-md text-text-muted">
          {formatLongDay(booking.starts_at)}, a las {formatClock(booking.starts_at)}. Haz la transferencia y la confirmamos en cuanto la veamos.
        </Text>
      </View>
      {payment.transfer ? <TransferDetails transfer={payment.transfer} payBy={booking.hold_expires_at} /> : null}
      <View className="gap-3">
        <Button label="Ver mi visita" onPress={() => router.replace({ pathname: "/(customer)/booking/[id]", params: { id: String(booking.id) } })} />
        <Button label="Volver al inicio" variant="outline" onPress={() => router.replace("/(customer)/(tabs)")} />
      </View>
    </View>
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
  const [addressId, setAddressId] = useState<number | null>(null);
  const [choosingAddress, setChoosingAddress] = useState(false);
  const [booking, setBooking] = useState<Schemas["BookingOut"] | null>(null);
  const [holdKeys] = useState(() => new IdempotencyKeys());
  const [payment, setPayment] = useState<Payment | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offerings = useResource(() => api.GET("/offerings"));
  const staff = useResource(() => api.GET("/staff"));
  const addresses = useAddresses();
  const knownAddressIds = useRef<Set<number> | null>(null);
  const offering = offerings.data?.find((o) => o.id === offeringId);
  const person = staff.data?.find((s) => s.id === staffId);
  const nextSlots = useNextSlots((staff.data ?? []).map((s) => s.id), offeringId ?? undefined);
  const daySlots = useDaySlots(staffId ?? 0, staffId ? (offeringId ?? undefined) : undefined, day);

  // Without a service from the previous screen, start with the first one offered.
  useEffect(() => {
    if (!offeringId && offerings.data?.[0]) setOfferingId(offerings.data[0].id);
  }, [offerings.data, offeringId]);

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

  function chooseAddress(id: number | null) {
    // A hold carries its address, so a different address needs a new hold.
    if (id !== addressId) {
      setBooking(null);
      setPayment(null);
      holdKeys.reset();
    }
    setAddressId(id);
    setChoosingAddress(false);
  }

  function go(next: Step) {
    // Changing an earlier choice drops a pending hold; it expires on its own.
    setBooking(null);
    setPayment(null);
    holdKeys.reset();
    setError(null);
    setStep(next);
  }

  async function pay() {
    if (!offering || !slot || !staffId || !addressId) return;
    setBusy(true);
    setError(null);
    let held = booking;
    if (!held) {
      const body = { staff_id: staffId, offering_id: offering.id, starts_at: slot, address_id: addressId };
      // A lost response is retried with the same key, so the customer gets their own hold back instead of a 409.
      const r = await api.POST("/bookings", { body, params: { header: { "idempotency-key": holdKeys.for(body) } } });
      if (!r.data) {
        setBusy(false);
        // Without an answer the hold may exist: keep the choice so "Pagar" retries with the same key.
        if (errorCode(r.error) !== "network_error") {
          setSlot(null);
          setStep(2);
        }
        setError(errorMessage(r.error));
        return;
      }
      held = r.data;
      setBooking(held);
    }
    let checkout = payment;
    if (!checkout || checkout.method !== method) {
      const r = await api.POST("/bookings/{booking_id}/checkout", { params: { path: { booking_id: held.id } }, body: { method } });
      if (!r.data) {
        setBusy(false);
        setError(paymentError(r.error));
        return;
      }
      checkout = r.data;
      setPayment(checkout);
    }
    const result = await settle(checkout);
    if (result.payment?.method === "spei") {
      // The hold now runs 24 h: show the new deadline with the instructions.
      const refreshed = await api.GET("/bookings/{booking_id}", { params: { path: { booking_id: held.id } } });
      if (refreshed.data) setBooking(refreshed.data);
    }
    setBusy(false);
    if (result.payment) setPaid(true);
    else setError(result.error ?? null);
  }

  if (booking && paid && payment?.method === "spei") return <AwaitingTransfer booking={booking} payment={payment} />;
  if (booking && paid) return <Confirmed name={person?.display_name ?? ""} booking={booking} />;

  const back = step > 1 ? () => go((step - 1) as Step) : undefined;
  const address = addresses.data?.find((a) => a.id === addressId);
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
      footer={
        <Button
          label={method === "spei" ? "Pagar por transferencia" : total !== undefined ? `Pagar ${formatMoney(total, currency)}` : "Pagar"}
          busy={busy}
          disabled={!offering || !slot || !address}
          onPress={pay}
        />
      }
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
          <AddressRow address={address} onChange={addresses.data?.length ? () => setChoosingAddress((v) => !v) : undefined} />
        </List>
        {addresses.loading && !addresses.data ? <SkeletonRows count={1} /> : null}
        {addresses.error ? <Notice tone="danger" text={addresses.error} /> : null}
        {choosingAddress || (addresses.data && !addresses.data.length) ? (
          <AddressChoices addresses={addresses.data ?? []} selected={addressId} onSelect={chooseAddress} />
        ) : null}
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

      <View className="gap-1">
        <SectionTitle title="Método de pago" />
        <PaymentMethodPicker value={method} onChange={setMethod} />
      </View>

      {error ? <Notice tone="danger" text={error} /> : null}
    </FlowScreen>
  );
}
