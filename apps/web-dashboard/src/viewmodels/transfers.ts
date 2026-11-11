import type { Schemas } from "@repo/api-client";
import { formatDateTime, formatMoney, type Lookups } from "./format";

type Transfer = Schemas["AdminTransferOut"];

export interface TransferRow {
  id: number;
  customerName: string;
  customerEmail: string | null;
  amount: string;
  reference: string;
  /** What it pays: a single visit (links to Reservas) or a plan cycle (links to Suscripciones). */
  target: { label: string; to: { path: string; query: Record<string, string> } };
  requestedAt: string;
  /** null once the hold lapsed: confirming then flags the payment for refund instead of booking anything. */
  payBy: string | null;
}

export function toTransferRow(t: Transfer, lookups: Pick<Lookups, "customer">): TransferRow {
  const customer = lookups.customer(t.customer_id);
  const target: TransferRow["target"] =
    t.booking_id !== null
      ? { label: `Reserva ${t.booking_id}`, to: { path: "/reservas", query: { reserva: String(t.booking_id), estado: "todas" } } }
      : { label: `Suscripción ${t.subscription_id}`, to: { path: "/suscripciones", query: { filtro: "todas" } } };
  return {
    id: t.id,
    customerName: customer.name,
    customerEmail: customer.email,
    amount: formatMoney(t.amount_minor, t.currency),
    reference: t.transfer?.reference ?? t.provider_ref,
    target,
    requestedAt: formatDateTime(t.created_at),
    payBy: t.pay_by ? formatDateTime(t.pay_by) : null,
  };
}
