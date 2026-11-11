import type { Schemas } from "@repo/api-client";
import { formatDayShort, formatMoney, type Lookups, type Tone } from "./format";

type Subscription = Schemas["AdminSubscriptionOut"];
type Cycle = Schemas["SubscriptionCycleOut"];
type SubscriptionStatus = Schemas["SubscriptionStatus"];

const WEEKDAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie"];

const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; tone: Tone }> = {
  active: { label: "Activa", tone: "success" },
  held: { label: "Pago pendiente", tone: "warning" },
  expired: { label: "Apartado vencido", tone: "neutral" },
  ended: { label: "Terminada", tone: "neutral" },
};

/** Badge: a cancelled plan stays active until its paid visits end; an ended one says why. */
export function subscriptionStatus(s: Subscription): { label: string; tone: Tone } {
  if (s.status === "active" && s.cancelled_at) return { label: "Cancela al cierre", tone: "warning" };
  if (s.status === "active" && pendingRenewal(s)) return { label: "Renovación sin pagar", tone: "warning" };
  if (s.status === "ended") return { label: s.end_reason === "unpaid" ? "Terminada sin pago" : "Cancelada", tone: "neutral" };
  return SUBSCRIPTION_STATUS[s.status];
}

/** A renewal cycle created on its charge day and not paid yet; it lapses at its `hold_expires_at`. */
export function pendingRenewal(s: Subscription): Cycle | undefined {
  const last = s.cycles.at(-1);
  return last && last.sequence > 1 && last.status === "held" ? last : undefined;
}

export const SUBSCRIPTION_FILTERS = [
  { id: "activas", label: "Activas", statuses: ["active"] },
  { id: "pendientes", label: "Pago pendiente", statuses: ["held"] },
  { id: "terminadas", label: "Terminadas", statuses: ["ended"] },
  { id: "vencidas", label: "Apartados vencidos", statuses: ["expired"] },
  { id: "todas", label: "Todas", statuses: ["active", "held", "ended", "expired"] },
] as const satisfies readonly { id: string; label: string; statuses: readonly SubscriptionStatus[] }[];

export const PAYMENT_METHOD_LABEL: Record<Schemas["PaymentMethod"], string> = { card: "Tarjeta", spei: "Transferencia SPEI" };

export type SubscriptionFilterId = (typeof SUBSCRIPTION_FILTERS)[number]["id"];

/** "Lun, Mié · 10:00": weekdays and the local start time shared by every visit. */
export function scheduleLabel(weekdays: readonly number[], visitStart: string): string {
  return `${weekdays.map((w) => WEEKDAYS_SHORT[w] ?? "?").join(", ")} · ${visitStart.slice(0, 5)}`;
}

/** The latest paid cycle, or the pending one while the customer is still paying. */
export function currentCycle(s: Subscription): Cycle | undefined {
  return s.cycles.filter((c) => c.status === "confirmed").at(-1) ?? s.cycles.at(-1);
}

export function cycleLabel(cycle: Cycle): string {
  return `${formatDayShort(cycle.starts_on)} – ${formatDayShort(cycle.ends_on)}`;
}

export interface SubscriptionRow {
  id: number;
  status: SubscriptionStatus;
  statusLabel: string;
  tone: Tone;
  customerName: string;
  customerEmail: string | null;
  planName: string;
  staffName: string;
  schedule: string;
  cycle: string;
  renews: string | null;
  nextCharge: string | null;
  price: string;
  visitsDone: number;
  visitsTotal: number;
}

export function toSubscriptionRow(s: Subscription, lookups: Pick<Lookups, "staffName" | "customer">): SubscriptionRow {
  const customer = lookups.customer(s.customer_id);
  const cycle = currentCycle(s);
  const meta = subscriptionStatus(s);
  return {
    id: s.id,
    status: s.status,
    statusLabel: meta.label,
    tone: meta.tone,
    customerName: customer.name,
    customerEmail: customer.email,
    planName: s.plan_name,
    staffName: lookups.staffName(s.staff_id),
    schedule: scheduleLabel(s.weekdays, s.visit_start),
    cycle: cycle ? cycleLabel(cycle) : "—",
    renews: s.renews_on ? formatDayShort(s.renews_on) : null,
    nextCharge: s.next_charge_on ? formatDayShort(s.next_charge_on) : null,
    price: formatMoney(s.price_minor, s.currency),
    visitsDone: cycle?.visits.filter((v) => v.status === "completed").length ?? 0,
    visitsTotal: cycle?.visits.length ?? 0,
  };
}
