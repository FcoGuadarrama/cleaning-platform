import type { Schemas } from "@repo/api-client";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api, errorMessage } from "../../src/api";
import { formatMoney, formatTime, nextBusinessDays } from "../../src/format";
import { Button, Card, StateView } from "../../src/ui";
import { useResource } from "../../src/useResource";
import { inputClass } from "../login";

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} className={`min-h-11 justify-center rounded-full border px-4 ${selected ? "border-primary bg-primary" : "border-border bg-surface"}`}>
      <Text className={selected ? "text-on-primary" : "text-text"}>{label}</Text>
    </Pressable>
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
    if (r.data?.status === "succeeded") router.replace("/(customer)/bookings");
    else setError(errorMessage(r.error));
  }

  if (booking && payment) {
    return (
      <View className="flex-1 gap-4 bg-background p-6">
        <Card>
          <Text className="text-lg font-semibold text-text">Confirma tu pago</Text>
          <Text className="text-md text-text">{name} · {formatTime(booking.starts_at)}</Text>
          <Text className="text-md text-text">Total: {formatMoney(payment.amount_minor, payment.currency)}</Text>
          <Text className="text-sm text-warning">Entorno de prueba: no se realiza ningún cobro real.</Text>
        </Card>
        {error ? <Text accessibilityRole="alert" className="text-md text-danger">{error}</Text> : null}
        <Button label="Pagar (prueba)" onPress={paySandbox} busy={busy} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4">
      <Text accessibilityRole="header" className="text-xl font-bold text-text">{name}</Text>
      <StateView loading={offerings.loading} error={offerings.error} empty={!offerings.data?.length} emptyText="Aún no hay servicios disponibles." onRetry={offerings.refresh}>
        <View className="flex-row flex-wrap gap-2">
          {(offerings.data ?? []).map((o) => (
            <Chip key={o.id} label={`${o.name} · ${formatMoney(o.price_minor, o.currency)}`} selected={offering?.id === o.id} onPress={() => { setOffering(o); setSlot(null); }} />
          ))}
        </View>
      </StateView>
      <ScrollView horizontal contentContainerClassName="gap-2" accessibilityLabel="Días disponibles">
        {days.map((d) => <Chip key={d} label={d.slice(5)} selected={d === day} onPress={() => { setDay(d); setSlot(null); }} />)}
      </ScrollView>
      {offering ? (
        <StateView loading={slots.loading} error={slots.error} empty={!slots.data?.slots.length} emptyText="Sin horarios disponibles este día." onRetry={slots.refresh}>
          <View className="flex-row flex-wrap gap-2">
            {(slots.data?.slots ?? []).map((s) => <Chip key={s.starts_at} label={formatTime(s.starts_at)} selected={slot === s.starts_at} onPress={() => setSlot(s.starts_at)} />)}
          </View>
        </StateView>
      ) : null}
      <TextInput accessibilityLabel="Dirección del servicio" placeholder="Dirección del servicio" value={address} onChangeText={setAddress} className={inputClass} />
      {error ? <Text accessibilityRole="alert" className="text-md text-danger">{error}</Text> : null}
      <Button label="Reservar y continuar al pago" onPress={reserve} busy={busy} disabled={!offering || !slot || address.length < 5} />
    </ScrollView>
  );
}
