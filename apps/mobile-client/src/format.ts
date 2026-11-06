import type { Schemas } from "@repo/api-client";
import type { Tone } from "./ui";

export const BUSINESS_TZ = "America/Mexico_City";

/** "$450 MXN": whole amounts without cents, ISO code after the figure. */
export function formatMoney(minor: number, currency: string) {
  const digits = minor % 100 === 0 ? 0 : 2;
  const amount = new Intl.NumberFormat("es-MX", { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(minor / 100);
  return `${amount} ${currency}`;
}

/** Amount without the currency code, for line items under a total that carries it. */
export function formatAmount(minor: number, currency: string) {
  return formatMoney(minor, currency).replace(` ${currency}`, "");
}

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: BUSINESS_TZ }).format(
    new Date(iso),
  );

export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone: BUSINESS_TZ }).format(new Date(iso));

const clockFormat = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: BUSINESS_TZ });

/** 24-hour clock ("14:30"), used for visit time ranges. */
export const formatClock = (iso: string) => clockFormat.format(new Date(iso));

export const formatRange = (startIso: string, endIso: string) => `${formatClock(startIso)} – ${formatClock(endIso)}`;

const monthYearFormat = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: BUSINESS_TZ });
export const formatMonthYear = (iso: string) => monthYearFormat.format(new Date(iso)).replace(" de ", " ");

const weekdayFormat = new Intl.DateTimeFormat("es-MX", { weekday: "long", timeZone: BUSINESS_TZ });
export const formatWeekday = (iso: string) => weekdayFormat.format(new Date(iso));

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

/** "Vie 6 nov" for summary rows. */
export function formatShortDay(iso: string) {
  const d = dayParts(iso);
  return `${sentenceCase(d.weekday)} ${d.day} ${d.month}`;
}

/** Calendar day (YYYY-MM-DD) of an instant in the business time zone. */
export const ymdOf = (iso: string | Date) => ymdFormat.format(typeof iso === "string" ? new Date(iso) : iso);

/** Monday–Sunday of the week containing `ymd`, shifted by `offset` weeks. */
export function weekOf(ymd: string, offset = 0): string[] {
  const base = new Date(`${ymd}T12:00:00Z`);
  const mondayShift = (base.getUTCDay() + 6) % 7;
  const monday = base.getTime() - mondayShift * 86_400_000 + offset * 7 * 86_400_000;
  return Array.from({ length: 7 }, (_, i) => new Date(monday + i * 86_400_000).toISOString().slice(0, 10));
}

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
