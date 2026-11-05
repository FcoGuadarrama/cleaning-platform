import type { Schemas } from "@repo/api-client";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, errorMessage } from "../../src/api";
import { businessDayInstant, dayParts, formatDuration, formatLongDay, formatMoney, formatTime, nextBusinessDays, sentenceCase } from "../../src/format";
import { Icon, type IconName } from "../../src/icons";
import { color } from "../../src/theme";
import { Avatar, Button, Field, Group, Notice, StateView } from "../../src/ui";
import { useResource } from "../../src/useResource";

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children?: ReactNode }) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2.5 px-1">
        <View className={`h-6 w-6 items-center justify-center rounded-full ${done ? "bg-primary" : "bg-primary-soft"}`}>
          {done ? <Icon name="check" size={14} color={color["on-primary"]} strokeWidth={3} /> : <Text className="text-xs font-bold text-primary">{n}</Text>}
        </View>
        <Text accessibilityRole="header" className="text-lg font-semibold text-text">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function DayTile({ ymd, selected, onPress }: { ymd: string; selected: boolean; onPress: () => void }) {
  const d = dayParts(businessDayInstant(ymd));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={formatLongDay(businessDayInstant(ymd))}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`h-[84px] w-16 items-center justify-center gap-0.5 rounded-lg active:opacity-80 ${selected ? "bg-primary" : "bg-surface-raised"}`}
    >
      <Text className={`text-xs font-semibold capitalize ${selected ? "text-on-primary" : "text-text-muted"}`}>{d.weekday}</Text>
      <Text className={`text-xl font-bold ${selected ? "text-on-primary" : "text-text"}`}>{d.day}</Text>
      <Text className={`text-xs capitalize ${selected ? "text-on-primary" : "text-text-muted"}`}>{d.month}</Text>
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
      className={`min-h-12 flex-1 items-center justify-center rounded-md active:opacity-80 ${selected ? "bg-primary" : "bg-surface-raised"}`}
    >
      <Text className={`text-md font-semibold ${selected ? "text-on-primary" : "text-text"}`}>{label}</Text>
    </Pressable>
  );
}

function OfferingRow({ offering, selected, onPress }: { offering: Schemas["OfferingOut"]; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} className="min-h-[60px] flex-row items-center gap-3 px-4 py-3 active:bg-surface">
      <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${selected ? "border-primary bg-primary" : "border-border"}`}>
        {selected ? <Icon name="check" size={14} color={color["on-primary"]} strokeWidth={3} /> : null}
      </View>
      <View className="flex-1">
        <Text className="text-md font-semibold text-text">{offering.name}</Text>
        <Text className="text-sm text-text-muted">{formatDuration(offering.duration_minutes)}</Text>
      </View>
      <Text className="text-md font-semibold text-text">{formatMoney(offering.price_minor, offering.currency)}</Text>
    </Pressable>
  );
}

function BottomBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="gap-3 border-t border-border/60 bg-surface-raised px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
      {children}
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <Icon name={icon} size={22} color={color.primary} />
      <View className="flex-1">
        <Text className="text-xs text-text-muted">{label}</Text>
        <Text className="text-md text-text">{value}</Text>
      </View>
    </View>
  );
}

export default function Book() {
  const { staffId, name } = useLocalSearchParams<{ staffId: string; name: string }>();
  const days = nextBusinessDays(10);
  const [offering, setOffering] = useState<Schemas["OfferingOut"] | null>(null);
  const [day, setDay] = useState(days[1] ?? days[0]!);
  const [slot, setSlot] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [booking, setBooking] = useState<Schemas["BookingOut"] | null>(null);
  const [payment, setPayment] = useState<Schemas["PaymentOut"] | null>(null);
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
    if (r.data?.status === "succeeded") router.replace("/(customer)/(tabs)/bookings");
    else setError(errorMessage(r.error));
  }

  if (booking && payment) {
    return (
      <View className="flex-1 bg-surface">
        <ScrollView contentContainerClassName="gap-6 px-4 pb-8 pt-4">
          <View className="items-center gap-3 pt-2">
            <Avatar name={name} size="xl" />
            <View className="items-center gap-1">
              <Text accessibilityRole="header" className="text-xl font-bold tracking-[-0.4px] text-text">Confirma tu pago</Text>
              <Text className="text-md text-text-muted">Visita con {name}</Text>
            </View>
          </View>
          <Group>
            {offering ? <DetailRow icon="home" label="Servicio" value={`${offering.name}, ${formatDuration(offering.duration_minutes)}`} /> : null}
            <DetailRow icon="calendar" label="Día" value={sentenceCase(formatLongDay(booking.starts_at))} />
            <DetailRow icon="clock" label="Hora" value={`${formatTime(booking.starts_at)} a ${formatTime(booking.ends_at)}`} />
            <DetailRow icon="pin" label="Dirección" value={booking.address} />
          </Group>
          {booking.hold_expires_at ? (
            <Text className="px-1 text-sm text-text-muted">Apartamos este horario para ti hasta las {formatTime(booking.hold_expires_at)}</Text>
          ) : null}
          <Notice tone="warning" text="Entorno de prueba: no se realiza ningún cobro real." />
          {error ? <Notice tone="danger" text={error} /> : null}
        </ScrollView>
        <BottomBar>
          <View className="flex-row items-baseline justify-between">
            <Text className="text-md text-text-muted">Total</Text>
            <Text className="text-xl font-bold text-text">{formatMoney(payment.amount_minor, payment.currency)}</Text>
          </View>
          <Button label="Pagar (prueba)" onPress={paySandbox} busy={busy} />
        </BottomBar>
      </View>
    );
  }

  const ready = !!offering && !!slot && address.trim().length >= 5;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100} className="flex-1 bg-surface">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-7 pb-8 pt-2">
        <View className="flex-row items-center gap-4 px-5">
          <Avatar name={name} size="lg" />
          <View className="flex-1">
            <Text accessibilityRole="header" className="text-xl font-bold tracking-[-0.4px] text-text">{name}</Text>
            <Text className="text-sm text-text-muted">Elige servicio, día y hora de la visita.</Text>
          </View>
        </View>

        <View className="px-4">
          <Step n={1} title="Servicio" done={!!offering}>
            <StateView loading={offerings.loading} error={offerings.error} empty={!offerings.data?.length} emptyIcon="home" emptyTitle="Aún no hay servicios disponibles" onRetry={offerings.refresh}>
              <Group>
                {(offerings.data ?? []).map((o) => (
                  <OfferingRow key={o.id} offering={o} selected={offering?.id === o.id} onPress={() => { setOffering(o); setSlot(null); }} />
                ))}
              </Group>
            </StateView>
          </Step>
        </View>

        <View className="gap-3">
          <View className="px-4">
            <Step n={2} title="Día" done={!!slot} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4" accessibilityLabel="Días disponibles">
            {days.map((d) => <DayTile key={d} ymd={d} selected={d === day} onPress={() => { setDay(d); setSlot(null); }} />)}
          </ScrollView>
        </View>

        <View className="px-4">
          <Step n={3} title="Hora" done={!!slot}>
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
              <Text className="px-1 text-sm text-text-muted">Elige un servicio para ver los horarios libres.</Text>
            )}
          </Step>
        </View>

        <View className="px-4">
          <Step n={4} title="Dirección" done={address.trim().length >= 5}>
            <Field label="Calle, número y colonia" placeholder="Ej. Av. Independencia 1200, Centro" value={address} onChangeText={setAddress} autoComplete="street-address" textContentType="fullStreetAddress" />
          </Step>
        </View>

        {error ? <View className="px-4"><Notice tone="danger" text={error} /></View> : null}
      </ScrollView>

      <BottomBar>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text numberOfLines={1} className="text-md font-semibold text-text">{offering?.name ?? "Elige un servicio"}</Text>
            <Text numberOfLines={1} className="text-sm text-text-muted">{slot ? sentenceCase(`${formatLongDay(slot)}, ${formatTime(slot)}`) : "Sin horario"}</Text>
          </View>
          {offering ? <Text className="text-lg font-bold text-text">{formatMoney(offering.price_minor, offering.currency)}</Text> : null}
        </View>
        <Button label="Reservar y pagar" onPress={reserve} busy={busy} disabled={!ready} />
      </BottomBar>
    </KeyboardAvoidingView>
  );
}
