import type { Schemas } from "@repo/api-client";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { api, errorCode, errorMessage } from "./api";
import { formatDateTime, formatDuration, formatMoney, formatRange, formatShortDay } from "./format";
import { type Payment, type PaymentMethod, PaymentMethodPicker, paymentError, settle, TransferDetails } from "./payment";
import { Text } from "./text";
import { Button, InfoNote, List, Notice, Row, SectionTitle, SkeletonRows, StatusDot } from "./ui";

type Booking = Schemas["BookingOut"];

/** Milliseconds left until `deadline`, refreshed every 30 s. */
function useRemaining(deadline: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return deadline ? Date.parse(deadline) - now : null;
}

function Deadline({ deadline, onLapsed }: { deadline: string | null; onLapsed: () => void }) {
  const remaining = useRemaining(deadline);
  const lapsed = remaining !== null && remaining <= 0;
  const reported = useRef(false);
  useEffect(() => {
    if (lapsed && !reported.current) {
      reported.current = true;
      onLapsed();
    }
  }, [lapsed, onLapsed]);
  if (!deadline || remaining === null) return null;
  return (
    <View className="flex-row items-end justify-between gap-4 border-t border-warning/25 pt-4">
      <View className="flex-1 gap-0.5">
        <Text className="text-sm text-text-muted">Paga antes del</Text>
        <Text className="text-md font-semibold text-text">{formatDateTime(deadline)}</Text>
      </View>
      <Text className="text-sm font-semibold text-warning">{lapsed ? "Venció" : `Quedan ${formatDuration(Math.ceil(remaining / 60_000))}`}</Text>
    </View>
  );
}

/** Pays a held visit that never finished checkout; a SPEI choice returns the transfer's details. */
function PayNow({ booking, pending, onPayment, onPaid }: { booking: Booking; pending: Payment | null; onPayment: (p: Payment) => void; onPaid: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    let checkout = pending?.method === method ? pending : null;
    if (!checkout) {
      const r = await api.POST("/bookings/{booking_id}/checkout", { params: { path: { booking_id: booking.id } }, body: { method } });
      if (!r.data) {
        setBusy(false);
        setError(paymentError(r.error));
        return;
      }
      checkout = r.data;
    }
    const result = await settle(checkout);
    setBusy(false);
    if (result.payment?.method === "spei") onPayment(result.payment);
    else if (result.payment) onPaid();
    else setError(result.error ?? null);
  }

  return (
    <View className="gap-3">
      <SectionTitle title="¿Cómo quieres pagar?" />
      <PaymentMethodPicker value={method} onChange={setMethod} />
      <Button label={method === "spei" ? "Pagar por transferencia" : `Pagar ${formatMoney(booking.price_minor, booking.currency)}`} busy={busy} onPress={pay} />
      {error ? <Notice tone="danger" text={error} /> : null}
    </View>
  );
}

/**
 * A one-off visit held until it is paid: why it is pending, how much, by when, and how to pay.
 * Replaces the visit detail while the booking is `held`; paying refreshes it into the confirmed visit.
 */
export function PaymentDue({ booking, staffName, serviceName, onChange }: { booking: Booking; staffName?: string; serviceName?: string; onChange: () => void }) {
  const [payment, setPayment] = useState<Payment | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void api.GET("/bookings/{booking_id}/payment", { params: { path: { booking_id: booking.id } } }).then((r) => {
      setPayment(r.data ?? null);
      // No pending payment (checkout never started) just means the customer still has to pay.
      if (r.error && errorCode(r.error) !== "not_found") setError(errorMessage(r.error));
    });
  }, [booking.id]);

  const transfer = payment?.transfer;
  const title = transfer ? "Esperando tu transferencia" : "Falta tu pago";
  const reason = transfer
    ? "Apartamos tu visita mientras llega tu transferencia SPEI. En cuanto un agente la confirme, queda agendada."
    : "Apartamos el horario, pero el pago no se completó. Paga ahora para confirmar tu visita.";

  function onTransfer(p: Payment) {
    setPayment(p);
    // SPEI extends the hold: reload the booking for the new deadline.
    onChange();
  }

  return (
    <View className="gap-8">
      <View className="gap-4 rounded-lg bg-warning-soft p-5">
        <View className="flex-row items-center gap-3">
          <StatusDot tone="warning" size={36} />
          <Text accessibilityRole="header" className="flex-1 text-xl font-semibold tracking-[-0.5px] text-text">{title}</Text>
        </View>
        <Text className="text-md text-text">{reason}</Text>
        <View className="gap-0.5">
          <Text className="text-sm text-text-muted">Total a pagar</Text>
          <Text className="text-[34px] font-semibold leading-[42px] tracking-[-1px] text-text">{formatMoney(booking.price_minor, booking.currency)}</Text>
        </View>
        <Deadline deadline={booking.hold_expires_at} onLapsed={onChange} />
      </View>

      {payment === undefined ? <SkeletonRows count={2} /> : null}
      {transfer ? (
        <View className="gap-3">
          <SectionTitle title="Datos para tu transferencia" />
          <TransferDetails transfer={transfer} />
        </View>
      ) : null}
      {payment !== undefined && !transfer ? <PayNow booking={booking} pending={payment} onPayment={onTransfer} onPaid={onChange} /> : null}
      {error ? <Notice tone="danger" text={error} /> : null}

      <View className="gap-1">
        <SectionTitle title="Tu visita" />
        <List>
          <Row icon="calendar" title="Fecha" value={`${formatShortDay(booking.starts_at)}, ${formatRange(booking.starts_at, booking.ends_at)}`} />
          {serviceName ? <Row icon="broom" title="Servicio" value={serviceName} /> : null}
          <Row icon="person" title="Profesional" value={staffName ?? "Personal asignado"} />
          <Row icon="pin" title="Domicilio" subtitle={booking.address} />
        </List>
      </View>

      <InfoNote text="Si el pago no llega a tiempo, liberamos el horario para alguien más." />
    </View>
  );
}
