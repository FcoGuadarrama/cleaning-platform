import type { BookingRow } from "./format";

export type SortDir = "asc" | "desc";

export const BOOKING_SORT_KEYS = ["numero", "fecha", "servicio", "cliente", "direccion", "estado", "importe"] as const;
export type BookingSortKey = (typeof BOOKING_SORT_KEYS)[number];

export interface BookingSort {
  key: BookingSortKey;
  dir: SortDir;
}

/** Newest first: the panel opens on the most recent bookings. */
export const DEFAULT_BOOKING_SORT: BookingSort = { key: "fecha", dir: "desc" };

/** Numbers and dates start descending on first click; text columns start alphabetically. */
export const FIRST_CLICK_DIR: Record<BookingSortKey, SortDir> = {
  numero: "desc",
  fecha: "desc",
  servicio: "asc",
  cliente: "asc",
  direccion: "asc",
  estado: "asc",
  importe: "desc",
};

const collator = new Intl.Collator("es-MX", { sensitivity: "base", numeric: true });

const COMPARE: Record<BookingSortKey, (a: BookingRow, b: BookingRow) => number> = {
  numero: (a, b) => a.id - b.id,
  fecha: (a, b) => a.startsAt - b.startsAt,
  servicio: (a, b) => collator.compare(a.offeringName, b.offeringName) || collator.compare(a.staffName, b.staffName),
  cliente: (a, b) => collator.compare(a.customerName, b.customerName),
  direccion: (a, b) => collator.compare(a.address, b.address),
  estado: (a, b) => collator.compare(a.statusLabel, b.statusLabel),
  importe: (a, b) => a.priceMinor - b.priceMinor,
};

/** Ties fall back to newest first so equal values keep a stable, predictable order. */
export function sortBookings(rows: readonly BookingRow[], sort: BookingSort): BookingRow[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  const compare = COMPARE[sort.key];
  return [...rows].sort((a, b) => sign * compare(a, b) || b.startsAt - a.startsAt || b.id - a.id);
}

export function nextSort(current: BookingSort, key: BookingSortKey): BookingSort {
  if (current.key !== key) return { key, dir: FIRST_CLICK_DIR[key] };
  return { key, dir: current.dir === "asc" ? "desc" : "asc" };
}

export interface BookingFilters {
  staffId: number | null;
  offeringName: string | null;
  /** Business-zone calendar days, inclusive (YYYY-MM-DD). */
  from: string | null;
  to: string | null;
  search: string;
}

export const NO_BOOKING_FILTERS: BookingFilters = { staffId: null, offeringName: null, from: null, to: null, search: "" };

/** "#12" looks up booking 12 exactly; any other text matches id, address, people or service. */
function matchesSearch(row: BookingRow, term: string): boolean {
  const trimmed = term.trim();
  const byNumber = /^#(\d+)$/.exec(trimmed);
  if (byNumber) return row.id === Number(byNumber[1]);
  const needle = trimmed.toLocaleLowerCase("es-MX");
  if (!needle) return true;
  return [String(row.id), row.address, row.staffName, row.offeringName, row.customerName, row.customerEmail ?? ""].some((v) =>
    v.toLocaleLowerCase("es-MX").includes(needle),
  );
}

export function filterBookings(rows: readonly BookingRow[], f: BookingFilters): BookingRow[] {
  return rows.filter(
    (r) =>
      (f.staffId === null || r.staffId === f.staffId) &&
      (f.offeringName === null || r.offeringName === f.offeringName) &&
      (f.from === null || r.day >= f.from) &&
      (f.to === null || r.day <= f.to) &&
      matchesSearch(r, f.search),
  );
}

/** Filters set in the toolbar (status tabs and search are counted separately). */
export function activeFilterCount(f: BookingFilters): number {
  return [f.staffId !== null, f.offeringName !== null, f.from !== null, f.to !== null].filter(Boolean).length;
}
