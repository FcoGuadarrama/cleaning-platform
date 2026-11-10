import type { Schemas } from "@repo/api-client";
import { businessDayInstant, formatShortDay, nextBusinessDays } from "./format";
import type { Tone } from "./ui";

export type Subscription = Schemas["SubscriptionOut"];

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"] as const;
export const WEEKDAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie"] as const;

/** Weekday of a business-calendar day (YYYY-MM-DD): 0 = Monday … 6 = Sunday, like the API. */
export const weekdayOf = (ymd: string) => (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7;

/** "Lunes", "Lunes y miércoles", "Lunes, miércoles y viernes". */
export function weekdaysLabel(weekdays: number[]) {
  const names = [...weekdays].sort().map((w, i) => (i === 0 ? WEEKDAYS[w]! : WEEKDAYS[w]!.toLowerCase()));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names.at(-1)}` : (names[0] ?? "");
}

/** "10:00:00" (API local time) → "10:00". */
export const formatTime = (t: string) => t.slice(0, 5);

/** "Lun 16 nov" for a business-calendar day. */
export const formatYmd = (ymd: string) => formatShortDay(businessDayInstant(ymd));

/** Days the first visit can fall on: the next business days on one of the chosen weekdays. */
export const firstVisitOptions = (weekdays: number[], lookahead = 15) =>
  nextBusinessDays(lookahead).filter((d) => weekdays.includes(weekdayOf(d)));

export const SUBSCRIPTION_LABELS: Record<Schemas["SubscriptionStatus"], string> = {
  held: "Pago pendiente",
  active: "Activa",
  expired: "Apartado vencido",
};

export const SUBSCRIPTION_TONES: Record<Schemas["SubscriptionStatus"], Tone> = {
  held: "warning",
  active: "success",
  expired: "neutral",
};

/** The cycle the customer is in now: the latest one paid, or the pending one while contracting. */
export function currentCycle(s: Subscription) {
  const paid = s.cycles.filter((c) => c.status === "confirmed");
  return paid.at(-1) ?? s.cycles.at(-1);
}

const ERRORS: Record<string, string> = {
  visits_unavailable: "Alguien acaba de apartar uno de esos horarios. Elige otro horario.",
  hold_expired: "El apartado venció antes de completar el pago. Vuelve a elegir el horario.",
  weekdays_mismatch: "Revisa los días elegidos.",
  start_too_far: "Elige una primera visita más cercana.",
  start_in_past: "Ese horario ya pasó. Elige otro.",
  outside_working_hours: "Ese horario queda fuera del horario de servicio.",
  not_found: "Este plan ya no está disponible. Regresa para ver los planes vigentes.",
};

/** Spanish copy for the contracting errors the customer can act on; null for anything else. */
export function subscriptionError(error: unknown): string | null {
  const code = (error as { code?: string } | undefined)?.code;
  return (code && ERRORS[code]) ?? null;
}
