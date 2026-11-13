import type { Schemas } from "@repo/api-client";
import { View } from "react-native";
import { api, errorCode, errorMessage } from "./api";
import { formatDateTime, formatMoney } from "./format";
import { Icon } from "./icons";
import { Text } from "./text";
import { color } from "./theme";
import { InfoNote, List, Row } from "./ui";

export type PaymentMethod = Schemas["PaymentMethod"];
export type Payment = Schemas["PaymentOut"];

const METHODS: { value: PaymentMethod; title: string; subtitle: string }[] = [
  { value: "card", title: "Tarjeta", subtitle: "Pago de prueba (sandbox): no se hace ningún cobro real" },
  { value: "spei", title: "Transferencia SPEI", subtitle: "Te apartamos el horario 24 h mientras confirmamos tu transferencia" },
];

/** Owner decision 2026-11-11: card or SPEI. */
export function PaymentMethodPicker({ value, onChange }: { value: PaymentMethod; onChange: (method: PaymentMethod) => void }) {
  return (
    <List>
      {METHODS.map((m) => (
        <Row
          key={m.value}
          icon={m.value === "card" ? "card" : "receipt"}
          title={m.title}
          subtitle={m.subtitle}
          onPress={() => onChange(m.value)}
          trailing={<Icon name={m.value === value ? "check" : "circle"} size={22} color={m.value === value ? color.primary : color.border} strokeWidth={2} />}
          accessibilityLabel={`${m.title}${m.value === value ? ", elegido" : ""}`}
        />
      ))}
    </List>
  );
}

/** What the customer needs to send a SPEI transfer; the agent finds it by the concept. */
export function TransferDetails({ transfer, payBy }: { transfer: NonNullable<Payment["transfer"]>; payBy?: string | null }) {
  const rows: [string, string][] = [
    ["Monto", formatMoney(transfer.amount_minor, transfer.currency)],
    ["CLABE", transfer.clabe],
    ["Banco", transfer.bank],
    ["Beneficiario", transfer.beneficiary],
    ["Concepto", transfer.reference],
  ];
  return (
    <View className="gap-3">
      <List>
        {rows.map(([label, value]) => (
          <View key={label} className="min-h-[52px] flex-row items-center justify-between gap-4 py-3">
            <Text className="text-md text-text-muted">{label}</Text>
            <Text selectable className="flex-1 text-right text-md font-semibold text-text">{value}</Text>
          </View>
        ))}
      </List>
      <InfoNote text={`Escribe el concepto tal cual para que identifiquemos tu pago.${payBy ? ` Tienes hasta el ${formatDateTime(payBy)}.` : ""} Un agente confirmará tu transferencia.`} />
    </View>
  );
}

const ERRORS: Record<string, string> = {
  payment_in_progress: "Ya tienes un pago en curso con el otro método. Termínalo o espera a que venza el apartado.",
  spei_unavailable: "La transferencia SPEI todavía no está disponible. Paga con tarjeta.",
  hold_expired: "El apartado venció antes de completar el pago. Vuelve a elegir el horario.",
};

/** Spanish copy for the payment errors the customer can act on. */
export function paymentError(error: unknown): string {
  const code = errorCode(error);
  return (code && ERRORS[code]) ?? errorMessage(error);
}

/** Card: sandbox charge right away. SPEI: the pending payment with its transfer instructions. */
export async function settle(payment: Payment): Promise<{ payment?: Payment; error?: string }> {
  if (payment.method === "spei") return { payment };
  const r = await api.POST("/payments/{payment_id}/sandbox-outcome", { params: { path: { payment_id: payment.id } }, body: { outcome: "succeeded" } });
  if (r.data?.status === "succeeded") return { payment: r.data };
  return { error: r.data ? "Tu tarjeta fue rechazada. Intenta de nuevo." : paymentError(r.error) };
}
