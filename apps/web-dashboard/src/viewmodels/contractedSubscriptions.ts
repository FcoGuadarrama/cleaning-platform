import type { Schemas } from "@repo/api-client";
import { formatDayShort, formatMoney, type Lookups, type Tone } from "./format";

type Subscription = Schemas["AdminSubscriptionOut"];
type Cycle = Schemas["SubscriptionCycleOut"];
type SubscriptionStatus = Schemas["SubscriptionStatus"];

const WEEKDAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie"];

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; tone: Tone }> = {
  active: { label: "Activa", tone: "success" },
  held: { label: "Pago pendiente", tone: "warning" },
  expired: { label: "Apartado vencido", tone: "neutral" },
};

export const SUBSCRIPTION_FILTERS = [
  { id: "activas", label: "Activas", statuses: ["active"] },
  { id: "pendientes", label: "Pago pendiente", statuses: ["held"] },
  { id: "vencidas", label: "Apartados vencidos", statuses: ["expired"] },
  { id: "todas", label: "Todas", statuses: ["active", "held", "expired"] },
] as const satisfies readonly { id: string; label: string; statuses: readonly SubscriptionStatus[] }[];

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
  price: string;
  visitsDone: number;
  visitsTotal: number;
}

export function toSubscriptionRow(s: Subscription, lookups: Pick<Lookups, "staffName" | "customer">): SubscriptionRow {
  const customer = lookups.customer(s.customer_id);
  const cycle = currentCycle(s);
  const meta = SUBSCRIPTION_STATUS[s.status];
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
    price: formatMoney(s.price_minor, s.currency),
    visitsDone: cycle?.visits.filter((v) => v.status === "completed").length ?? 0,
    visitsTotal: cycle?.visits.length ?? 0,
  };
}
