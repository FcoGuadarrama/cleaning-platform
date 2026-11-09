import type { Schemas } from "@repo/api-client";

export const BUSINESS_TZ = "America/Mexico_City";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";
type BookingStatus = Schemas["BookingStatus"];

const moneyFormats = new Map<string, Intl.NumberFormat>();
const timeFormat = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: BUSINESS_TZ });
const dateTimeFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: BUSINESS_TZ });
const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
// Calendar days are handled as ISO strings and rendered at UTC noon so no offset can move them.
const dayLongFormat = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const dayShortFormat = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dayCompactFormat = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
const rangeFormat = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "UTC" });

export function formatMoney(minor: number, currency: string): string {
  let format = moneyFormats.get(currency);
  if (!format) {
    format = new Intl.NumberFormat("es-MX", { style: "currency", currency });
    moneyFormats.set(currency, format);
  }
  return format.format(minor / 100);
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function toMinor(input: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(input.trim())) return null;
  const [whole, frac = ""] = input.trim().split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

function zonedParts(date: Date): { day: string; minutes: number } {
  const p = Object.fromEntries(partsFormat.formatToParts(date).map((part) => [part.type, part.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** ISO calendar day (YYYY-MM-DD) in the business time zone. */
export function businessDay(date: Date): string {
  return zonedParts(date).day;
}

/** Minutes since local midnight in the business time zone. */
export function minutesIntoDay(date: Date): number {
  return zonedParts(date).minutes;
}

/** `YYYY-MM-DDTHH:mm` wall time in the business time zone, as used by `<input type="datetime-local">`. */
export function toBusinessWallTime(date: Date): string {
  const { day, minutes } = zonedParts(date);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${day}T${hh}:${mm}`;
}

export function fromBusinessWallTime(wall: string): string {
  const [day = "", time = ""] = wall.split("T");
  const [y, mo, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  const seen = zonedParts(new Date(guess));
  const [sy, smo, sd] = seen.day.split("-").map(Number);
  const offset = Date.UTC(sy!, smo! - 1, sd!) + seen.minutes * 60_000 - guess;
  return new Date(guess - offset).toISOString();
}

function noonUtc(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

export function shiftDay(day: string, days: number): string {
  const d = noonUtc(day);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(date: Date): string {
  const day = businessDay(date);
  return shiftDay(day, -((noonUtc(day).getUTCDay() + 6) % 7));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDayLong(day: string): string {
  return capitalize(dayLongFormat.format(noonUtc(day)));
}

export function formatDayShort(day: string): string {
  return capitalize(dayShortFormat.format(noonUtc(day)));
}

/** "7 oct": axis labels where the weekday would not fit. */
export function formatDayCompact(day: string): string {
  return dayCompactFormat.format(noonUtc(day)).replace(".", "");
}

export function formatWeekRange(monday: string): string {
  return rangeFormat.formatRange(noonUtc(monday), noonUtc(shiftDay(monday, 6)));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
  held: { label: "Pago pendiente", tone: "warning" },
  expired: { label: "Expirada", tone: "neutral" },
  confirmed: { label: "Confirmada", tone: "info" },
  in_progress: { label: "En curso", tone: "info" },
  pending_review: { label: "Revisión pendiente", tone: "warning" },
  completed: { label: "Completada", tone: "success" },
  disputed: { label: "En disputa", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

export const BOOKING_FILTERS = [
  { id: "proximas", label: "Próximas", statuses: ["held", "confirmed"], soonestFirst: true },
  { id: "en-curso", label: "En curso", statuses: ["in_progress"], soonestFirst: true },
  { id: "revisar", label: "Por revisar", statuses: ["pending_review", "disputed"], soonestFirst: false },
  { id: "completadas", label: "Completadas", statuses: ["completed"], soonestFirst: false },
  { id: "canceladas", label: "Canceladas", statuses: ["cancelled", "expired"], soonestFirst: false },
  { id: "todas", label: "Todas", statuses: Object.keys(BOOKING_STATUS), soonestFirst: false },
] as const satisfies readonly { id: string; label: string; statuses: readonly string[]; soonestFirst: boolean }[];

export type BookingFilterId = (typeof BOOKING_FILTERS)[number]["id"];

/** Statuses that occupy a cleaner's time and therefore appear on the day agenda. */
export const SCHEDULED_STATUSES: ReadonlySet<BookingStatus> = new Set([
  "held",
  "confirmed",
  "in_progress",
  "pending_review",
  "completed",
  "disputed",
]);

export interface Lookups {
  staffName: (id: number) => string;
  offeringName: (id: number) => string;
  customer: (id: number) => { name: string; email: string | null };
}

/** Statuses an admin can still cancel (`held|confirmed → cancelled` in docs/DOMAIN.md). */
export const CANCELLABLE_STATUSES: ReadonlySet<BookingStatus> = new Set(["held", "confirmed"]);

export interface BookingRow {
  id: number;
  status: BookingStatus;
  statusLabel: string;
  tone: Tone;
  day: string;
  dayLabel: string;
  timeRange: string;
  startMinutes: number;
  endMinutes: number;
  startsAt: number;
  amount: string;
  address: string;
  staffId: number;
  staffName: string;
  offeringName: string;
  customerName: string;
  customerEmail: string | null;
}

export function toBookingRow(b: Schemas["BookingOut"], lookups: Lookups): BookingRow {
  const start = new Date(b.starts_at);
  const end = new Date(b.ends_at);
  const day = businessDay(start);
  const meta = BOOKING_STATUS[b.status];
  const customer = lookups.customer(b.customer_id);
  return {
    id: b.id,
    status: b.status,
    statusLabel: meta.label,
    tone: meta.tone,
    day,
    dayLabel: formatDayShort(day),
    timeRange: `${formatTime(b.starts_at)}–${formatTime(b.ends_at)}`,
    startMinutes: minutesIntoDay(start),
    endMinutes: businessDay(end) === day ? minutesIntoDay(end) : 24 * 60,
    startsAt: start.getTime(),
    amount: formatMoney(b.price_minor, b.currency),
    address: b.address,
    staffId: b.staff_id,
    staffName: lookups.staffName(b.staff_id),
    offeringName: lookups.offeringName(b.offering_id),
    customerName: customer.name,
    customerEmail: customer.email,
  };
}
