import type { Schemas } from "@repo/api-client";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { HorizontalScroll } from "../../src/HorizontalScroll";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, errorMessage } from "../../src/api";
import { businessDayInstant, dayParts, formatDuration, formatLongDay, formatMoney, formatTime, nextBusinessDays, sentenceCase } from "../../src/format";
import { Icon, type IconName } from "../../src/icons";
import { color, shadow } from "../../src/theme";
import { FlowHeader } from "../../src/FlowHeader";
import { Avatar, Button, Card, Field, IconTile, Notice, StateView, toneFor } from "../../src/ui";
import { useResource } from "../../src/useResource";

const SERVICE_ICONS: IconName[] = ["home", "sparkle", "drop", "broom"];

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <Card className="gap-4">
      <View className="flex-row items-center gap-3">
        <View className={`h-7 w-7 items-center justify-center rounded-full ${done ? "bg-primary" : "bg-primary-soft"}`}>
          {done ? <Icon name="check" size={15} color={color["on-primary"]} strokeWidth={3} /> : <Text className="text-sm font-extrabold text-primary">{n}</Text>}
        </View>
        <Text accessibilityRole="header" className="text-lg font-bold text-text">{title}</Text>
      </View>
      {children}
    </Card>
  );
}

function OfferingOption({ offering, index, selected, onPress }: { offering: Schemas["OfferingOut"]; index: number; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-lg border-2 p-3 active:opacity-90 ${selected ? "border-primary bg-primary-soft" : "border-border/60 bg-surface-raised"}`}
    >
      <IconTile icon={SERVICE_ICONS[index % SERVICE_ICONS.length]!} tone={toneFor(index)} size={44} />
      <View className="flex-1">
        <Text className="text-md font-bold text-text">{offering.name}</Text>
        <Text className="text-sm text-text-muted">{formatDuration(offering.duration_minutes)}</Text>
      </View>
      <Text className="text-md font-extrabold text-text">{formatMoney(offering.price_minor, offering.currency)}</Text>
    </Pressable>
  );
}

function DayTile({ ymd, selected, onPress }: { ymd: string; selected: boolean; onPress: () => void }) {
  const d = dayParts(businessDayInstant(ymd));
  const ink = selected ? "text-on-primary" : "text-text";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={formatLongDay(businessDayInstant(ymd))}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={selected ? shadow("2", color.primary) : undefined}
      className={`h-[88px] w-[64px] items-center justify-center gap-0.5 rounded-xl active:opacity-85 ${selected ? "bg-primary" : "bg-surface"}`}
    >
      <Text className={`text-xs font-bold capitalize ${selected ? "text-on-primary" : "text-text-muted"}`}>{d.weekday}</Text>
      <Text className={`text-xl font-extrabold ${ink}`}>{d.day}</Text>
      <Text className={`text-xs font-medium capitalize ${selected ? "text-on-primary" : "text-text-muted"}`}>{d.month}</Text>
    </Pressable>
  );
}

/** Equal-width time grid: fixed rows keep the last row aligned with the ones above. */
function rowsOf<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function TimePill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-12 flex-1 items-center justify-center rounded-full active:opacity-85 ${selected ? "bg-primary" : "bg-surface"}`}
    >
      <Text className={`text-sm font-bold ${selected ? "text-on-primary" : "text-text"}`}>{label}</Text>
    </Pressable>
  );
}

function BottomBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="gap-3 rounded-t-2xl bg-surface-raised px-5 pt-4" style={[{ paddingBottom: Math.max(insets.bottom, 16) }, shadow("3")]}>
      {children}
    </View>
  );
}

function TicketRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <IconTile icon={icon} size={40} />
      <View className="flex-1">
        <Text className="text-xs font-semibold text-text-muted">{label}</Text>
        <Text className="text-md font-medium text-text">{value}</Text>
      </View>
    </View>
  );
}

/** Perforated divider: the confirmation reads as a ticket. */
function Perforation() {
  return (
    <View className="-mx-4 my-1 flex-row items-center">
      <View className="-ml-3 h-6 w-6 rounded-full bg-surface" />
      <View className="mx-2 flex-1 border-t-2 border-dashed border-border" />
      <View className="-mr-3 h-6 w-6 rounded-full bg-surface" />
    </View>
  );
}

function Confirmed({ name, booking }: { name: string; booking: Schemas["BookingOut"] }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 justify-center gap-8 bg-surface px-6" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}>
      <View className="items-center gap-5">
        <Animated.View entering={ZoomIn.springify().damping(14).stiffness(180)} className="h-24 w-24 items-center justify-center rounded-full bg-success-soft">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-success">
            <Icon name="check" size={34} color={color["on-success"]} strokeWidth={3} />
          </View>
        </Animated.View>
        <View className="items-center gap-2">
          <Text accessibilityRole="header" className="text-2xl font-extrabold tracking-[-0.8px] text-text">Visita confirmada</Text>
          <Text className="text-center text-md text-text-muted">
            {name} te visitará el {formatLongDay(booking.starts_at)}, a las {formatTime(booking.starts_at)}
          </Text>
        </View>
      </View>
      <View className="gap-3">
        <Button label="Ver mis reservas" onPress={() => router.replace("/(customer)/(tabs)/bookings")} />
        <Button label="Volver al inicio" variant="soft" onPress={() => router.replace("/(customer)/(tabs)")} />
      </View>
    </View>
  );
}

export default function Book() {
  const params = useLocalSearchParams<{ staffId: string; name: string; offeringId?: string; day?: string; slot?: string }>();
  const { staffId, name, offeringId } = params;
  const days = nextBusinessDays(10);
  const [offering, setOffering] = useState<Schemas["OfferingOut"] | null>(null);
  const [day, setDay] = useState(params.day && days.includes(params.day) ? params.day : (days[1] ?? days[0]!));
  const [slot, setSlot] = useState<string | null>(params.slot ?? null);
  const [address, setAddress] = useState("");
  const [booking, setBooking] = useState<Schemas["BookingOut"] | null>(null);
  const [payment, setPayment] = useState<Schemas["PaymentOut"] | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offerings = useResource(() => api.GET("/offerings"));
  const slots = useResource(
    async () =>
      offering
        ? api.GET("/staff/{staff_id}/availability", { params: { path: { staff_id: Number(staffId) }, query: { offering_id: offering.id, day } } })
        : { data: undefined },
    [offering?.id, day],
  );

  // A service chosen on the home screen arrives preselected.
  useEffect(() => {
    if (offering || !offeringId) return;
    const match = offerings.data?.find((o) => o.id === Number(offeringId));
    if (match) setOffering(match);
  }, [offerings.data, offeringId, offering]);

  async function reserve() {
    if (!offering || !slot) return;
    setBusy(true);
    const held = await api.POST("/bookings", { body: { staff_id: Number(staffId), offering_id: offering.id, starts_at: slot, address } });
    if (!held.data) {
      setBusy(false);
      setError(errorMessage(held.error));
      void slots.refresh();
      return;
    }
    const pay = await api.POST("/bookings/{booking_id}/checkout", { params: { path: { booking_id: held.data.id } } });
    setBusy(false);
    setBooking(held.data);
    setPayment(pay.data ?? null);
    setError(pay.data ? null : errorMessage(pay.error));
  }

  async function paySandbox() {
    if (!payment) return;
    setBusy(true);
    const r = await api.POST("/payments/{payment_id}/sandbox-outcome", { params: { path: { payment_id: payment.id } }, body: { outcome: "succeeded" } });
    setBusy(false);
    if (r.data?.status === "succeeded") setPaid(true);
    else setError(errorMessage(r.error));
  }

  if (booking && paid) return <Confirmed name={name} booking={booking} />;

  if (booking && payment) {
    return (
      <View className="flex-1 bg-surface">
        <ScrollView contentContainerClassName="pb-8">
          <FlowHeader fallback="/(customer)/(tabs)">
            <Text accessibilityRole="header" className="text-2xl font-extrabold tracking-[-0.8px] text-on-primary">Confirma tu pago</Text>
            {booking.hold_expires_at ? (
              <Text className="mt-1 text-md text-on-primary opacity-80">Apartamos tu horario hasta las {formatTime(booking.hold_expires_at)}</Text>
            ) : null}
          </FlowHeader>
          <View className="-mt-8 gap-4 px-4">
            <Card className="gap-4">
              <View className="flex-row items-center gap-3">
                <Avatar name={name} tone={toneFor(Number(staffId))} />
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-text-muted">Te visita</Text>
                  <Text className="text-lg font-bold text-text">{name}</Text>
                </View>
              </View>
              <Perforation />
              {offering ? <TicketRow icon="sparkle" label="Servicio" value={`${offering.name}, ${formatDuration(offering.duration_minutes)}`} /> : null}
              <TicketRow icon="calendar" label="Día" value={sentenceCase(formatLongDay(booking.starts_at))} />
              <TicketRow icon="clock" label="Hora" value={`${formatTime(booking.starts_at)} a ${formatTime(booking.ends_at)}`} />
              <TicketRow icon="pin" label="Dirección" value={booking.address} />
              <Perforation />
              <View className="flex-row items-baseline justify-between">
                <Text className="text-md font-semibold text-text-muted">Total</Text>
                <Text className="text-2xl font-extrabold tracking-[-0.6px] text-text">{formatMoney(payment.amount_minor, payment.currency)}</Text>
              </View>
            </Card>
            <Notice tone="warning" text="Entorno de prueba: no se realiza ningún cobro real." />
            {error ? <Notice tone="danger" text={error} /> : null}
          </View>
        </ScrollView>
        <BottomBar>
          <Button label={`Pagar ${formatMoney(payment.amount_minor, payment.currency)} (prueba)`} onPress={paySandbox} busy={busy} />
        </BottomBar>
      </View>
    );
  }

  const ready = !!offering && !!slot && address.trim().length >= 5;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-surface">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pb-8">
        <FlowHeader fallback="/(customer)/(tabs)">
          <View className="flex-row items-center gap-4">
            <Avatar name={name} tone={toneFor(Number(staffId))} size="lg" ring />
            <View className="flex-1 gap-1">
              <Text accessibilityRole="header" className="text-2xl font-extrabold tracking-[-0.8px] text-on-primary">{name}</Text>
              <View className="flex-row items-center gap-1.5">
                <Icon name="star" size={15} color={color.accent} filled strokeWidth={1.5} />
                <Text className="text-sm font-medium text-on-primary opacity-80">Aún sin reseñas</Text>
              </View>
            </View>
          </View>
        </FlowHeader>

        <View className="-mt-8 gap-4 px-4">
          <Step n={1} title="¿Qué servicio necesitas?" done={!!offering}>
            <StateView loading={offerings.loading} error={offerings.error} empty={!offerings.data?.length} emptyIcon="sparkle" emptyTitle="Aún no hay servicios disponibles" onRetry={offerings.refresh}>
              <View className="gap-2">
                {(offerings.data ?? []).map((o, i) => (
                  <OfferingOption key={o.id} offering={o} index={i} selected={offering?.id === o.id} onPress={() => { setOffering(o); setSlot(null); }} />
                ))}
              </View>
            </StateView>
          </Step>

          <Step n={2} title="¿Qué día?" done={!!slot}>
            <HorizontalScroll className="-mx-4" contentContainerClassName="gap-2 px-4 py-1" accessibilityLabel="Días disponibles">
              {days.map((d) => <DayTile key={d} ymd={d} selected={d === day} onPress={() => { setDay(d); setSlot(null); }} />)}
            </HorizontalScroll>
          </Step>

          <Step n={3} title="¿A qué hora?" done={!!slot}>
            {offering ? (
              <StateView loading={slots.loading} error={slots.error} empty={!slots.data?.slots.length} emptyIcon="clock" emptyTitle="Sin horarios este día" emptyText="Prueba con otro día." onRetry={slots.refresh}>
                <View className="gap-2">
                  {rowsOf(slots.data?.slots ?? [], 3).map((row) => (
                    <View key={row[0]!.starts_at} className="flex-row gap-2">
                      {row.map((s) => <TimePill key={s.starts_at} label={formatTime(s.starts_at)} selected={slot === s.starts_at} onPress={() => setSlot(s.starts_at)} />)}
                      {Array.from({ length: 3 - row.length }, (_, i) => <View key={i} className="flex-1" />)}
                    </View>
                  ))}
                </View>
              </StateView>
            ) : (
              <Text className="text-sm text-text-muted">Elige un servicio para ver los horarios libres.</Text>
            )}
          </Step>

          <Step n={4} title="¿Dónde?" done={address.trim().length >= 5}>
            <Field label="Calle, número y colonia" icon="pin" placeholder="Ej. Av. Independencia 1200, Centro" value={address} onChangeText={setAddress} autoComplete="street-address" textContentType="fullStreetAddress" />
          </Step>

          {error ? <Notice tone="danger" text={error} /> : null}
        </View>
      </ScrollView>

      <BottomBar>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text numberOfLines={1} className="text-md font-bold text-text">{offering?.name ?? "Elige un servicio"}</Text>
            <Text numberOfLines={1} className="text-sm text-text-muted">{slot ? sentenceCase(`${formatLongDay(slot)}, ${formatTime(slot)}`) : "Sin horario todavía"}</Text>
          </View>
          {offering ? <Text className="text-xl font-extrabold tracking-[-0.4px] text-text">{formatMoney(offering.price_minor, offering.currency)}</Text> : null}
        </View>
        <Button label="Reservar y pagar" onPress={reserve} busy={busy} disabled={!ready} />
      </BottomBar>
    </KeyboardAvoidingView>
  );
}
