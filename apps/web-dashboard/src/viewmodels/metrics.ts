import type { Schemas } from "@repo/api-client";
import { BOOKING_STATUS, businessDay, formatDayCompact, formatDayShort, formatWeekRange, mondayOf, shiftDay } from "./format";

type Booking = Schemas["BookingOut"];
type BookingStatus = Schemas["BookingStatus"];

/** Statuses whose payment went through: single visits count as sales. A subscription visit is paid with its
 * cycle (price 0 on the booking), so it counts toward bookings and hours but not toward sales or the ticket. */
const PAID: ReadonlySet<BookingStatus> = new Set(["confirmed", "in_progress", "pending_review", "completed", "disputed"]);
const VOID: ReadonlySet<BookingStatus> = new Set(["cancelled", "expired"]);

export const RANGES = [
  { id: "7", label: "7 días", days: 7, bucket: "day" },
  { id: "30", label: "30 días", days: 30, bucket: "day" },
  { id: "90", label: "90 días", days: 90, bucket: "week" },
] as const;
export type RangeId = (typeof RANGES)[number]["id"];

export interface Bucket {
  key: string;
  /** Short axis label ("7 oct"). */
  label: string;
  /** Full label for tooltips and the table view. */
  title: string;
  sales: number;
  bookings: number;
  minutes: number;
  paidCount: number;
}

export interface Kpi {
  value: number;
  previous: number;
  /** Fractional change vs the previous period; null when there is nothing to compare against. */
  delta: number | null;
  trend: number[];
}

export interface Metrics {
  currency: string;
  buckets: Bucket[];
  sales: Kpi;
  bookings: Kpi;
  avgTicket: Kpi;
  hours: Kpi;
  byStatus: { status: BookingStatus; label: string; count: number }[];
  byStaff: { staffId: number; sales: number; count: number }[];
}

interface Totals {
  sales: number;
  bookings: number;
  minutes: number;
  paidCount: number;
}

function totals(list: Booking[]): Totals {
  const t: Totals = { sales: 0, bookings: 0, minutes: 0, paidCount: 0 };
  for (const b of list) {
    if (!VOID.has(b.status)) t.bookings += 1;
    if (PAID.has(b.status)) {
      t.minutes += (Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60_000;
      if (b.subscription_cycle_id === null) {
        t.sales += b.price_minor;
        t.paidCount += 1;
      }
    }
  }
  return t;
}

function change(value: number, previous: number): number | null {
  return previous === 0 ? null : (value - previous) / previous;
}

function kpi(value: number, previous: number, trend: number[]): Kpi {
  return { value, previous, delta: change(value, previous), trend };
}

/** Aggregates bookings that start inside the last `days` business days ending `today` (inclusive). */
export function computeMetrics(all: Booking[], today: string, rangeId: RangeId): Metrics {
  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[0];
  const start = shiftDay(today, -(range.days - 1));
  const prevStart = shiftDay(start, -range.days);
  const withDay = all.map((b) => ({ b, day: businessDay(new Date(b.starts_at)) }));
  const current = withDay.filter((x) => x.day >= start && x.day <= today);
  const previous = withDay.filter((x) => x.day >= prevStart && x.day < start).map((x) => x.b);

  const keyOf = range.bucket === "week" ? (day: string) => mondayOf(new Date(`${day}T12:00:00Z`)) : (day: string) => day;
  const buckets: Bucket[] = [];
  const index = new Map<string, Bucket>();
  for (let day = start; day <= today; day = shiftDay(day, 1)) {
    const key = keyOf(day);
    if (index.has(key)) continue;
    const title = range.bucket === "week" ? `Semana del ${formatWeekRange(key)}` : formatDayShort(key);
    const bucket = { key, label: formatDayCompact(key), title, sales: 0, bookings: 0, minutes: 0, paidCount: 0 };
    index.set(key, bucket);
    buckets.push(bucket);
  }
  for (const { b, day } of current) {
    const bucket = index.get(keyOf(day));
    if (!bucket) continue;
    const t = totals([b]);
    bucket.sales += t.sales;
    bucket.bookings += t.bookings;
    bucket.minutes += t.minutes;
    bucket.paidCount += t.paidCount;
  }

  const now = totals(current.map((x) => x.b));
  const before = totals(previous);
  const avg = (t: Totals) => (t.paidCount === 0 ? 0 : Math.round(t.sales / t.paidCount));

  const statusCounts = new Map<BookingStatus, number>();
  const staff = new Map<number, { sales: number; count: number }>();
  for (const { b } of current) {
    statusCounts.set(b.status, (statusCounts.get(b.status) ?? 0) + 1);
    if (PAID.has(b.status) && b.subscription_cycle_id === null) {
      const s = staff.get(b.staff_id) ?? { sales: 0, count: 0 };
      s.sales += b.price_minor;
      s.count += 1;
      staff.set(b.staff_id, s);
    }
  }

  return {
    currency: all[0]?.currency ?? "MXN",
    buckets,
    sales: kpi(now.sales, before.sales, buckets.map((x) => x.sales)),
    bookings: kpi(now.bookings, before.bookings, buckets.map((x) => x.bookings)),
    avgTicket: kpi(avg(now), avg(before), buckets.map((x) => (x.paidCount ? x.sales / x.paidCount : 0))),
    hours: kpi(now.minutes / 60, before.minutes / 60, buckets.map((x) => x.minutes / 60)),
    byStatus: [...statusCounts.entries()]
      .map(([status, count]) => ({ status, label: BOOKING_STATUS[status].label, count }))
      .sort((a, b) => b.count - a.count),
    byStaff: [...staff.entries()].map(([staffId, s]) => ({ staffId, ...s })).sort((a, b) => b.sales - a.sales),
  };
}

const compactMoney = new Map<string, Intl.NumberFormat>();

/** $12.4 k style for axis ticks and tiles; full amounts stay in tooltips and tables. */
export function formatMoneyCompact(minor: number, currency: string): string {
  let f = compactMoney.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("es-MX", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });
    compactMoney.set(currency, f);
  }
  return f.format(minor / 100);
}

export function formatDelta(delta: number): string {
  const pct = Math.round(delta * 100);
  return `${pct > 0 ? "+" : ""}${pct} %`;
}

/** Round axis maximum and ticks: 0, step, 2·step… covering `max`. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v < max + step; v += step) ticks.push(v);
  return ticks;
}
