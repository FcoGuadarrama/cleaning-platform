import type { Schemas } from "@repo/api-client";

export const BUSINESS_TZ = "America/Mexico_City";

export const formatMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(minor / 100);

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: BUSINESS_TZ }).format(
    new Date(iso),
  );

export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone: BUSINESS_TZ }).format(new Date(iso));

export const BOOKING_LABELS: Record<Schemas["BookingStatus"], string> = {
  held: "Pago pendiente",
  expired: "Expirada",
  confirmed: "Confirmada",
  in_progress: "En curso",
  pending_review: "En revisión",
  completed: "Completada",
  disputed: "En revisión por administración",
  cancelled: "Cancelada",
};

/** Next N business days (Mon–Fri) as YYYY-MM-DD in the business time zone. */
export function nextBusinessDays(count: number, from = new Date()): string[] {
  const out: string[] = [];
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TZ, weekday: "short" });
  for (let i = 0; out.length < count && i < count * 2 + 4; i++) {
    const d = new Date(from.getTime() + i * 86_400_000);
    if (!["Sat", "Sun"].includes(weekday.format(d))) out.push(fmt.format(d));
  }
  return out;
}
