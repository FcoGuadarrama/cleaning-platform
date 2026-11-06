import type { Schemas } from "@repo/api-client";
import type { Tone } from "./ui";

export const BUSINESS_TZ = "America/Mexico_City";

export const formatMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(minor / 100);

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: BUSINESS_TZ }).format(
    new Date(iso),
  );

export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone: BUSINESS_TZ }).format(new Date(iso));

const partsFormat = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: BUSINESS_TZ });
const longDayFormat = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: BUSINESS_TZ });

const clean = (s: string) => s.replace(".", "");

/** Weekday, day number and month of an instant, in the business time zone. */
export function dayParts(iso: string) {
  const parts = Object.fromEntries(partsFormat.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { weekday: clean(parts.weekday ?? ""), day: parts.day ?? "", month: clean(parts.month ?? "") };
}

/** A business-calendar day (YYYY-MM-DD) as an instant at local noon, safe for `dayParts`. */
export const businessDayInstant = (ymd: string) => `${ymd}T18:00:00Z`;

export const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ymdFormat = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const shortDayFormat = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: BUSINESS_TZ });

/** "Hoy", "Mañana" or a short date ("jue 12 nov"), in the business time zone. */
export function formatRelativeDay(iso: string, now = new Date()) {
  const target = ymdFormat.format(new Date(iso));
  if (target === ymdFormat.format(now)) return "Hoy";
  if (target === ymdFormat.format(new Date(now.getTime() + 86_400_000))) return "Mañana";
  return shortDayFormat.format(new Date(iso)).replace(/\./g, "");
}

export const formatLongDay = (iso: string) => longDayFormat.format(new Date(iso));

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

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

export const BOOKING_TONES: Record<Schemas["BookingStatus"], Tone> = {
  held: "warning",
  expired: "neutral",
  confirmed: "success",
  in_progress: "primary",
  pending_review: "warning",
  completed: "neutral",
  disputed: "warning",
  cancelled: "neutral",
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
