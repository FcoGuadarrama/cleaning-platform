import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOOKING_SORT,
  NO_BOOKING_FILTERS,
  activeFilterCount,
  filterBookings,
  nextSort,
  sortBookings,
} from "./bookingTable";
import type { BookingRow } from "./format";

function row(id: number, over: Partial<BookingRow>): BookingRow {
  return {
    id,
    status: "confirmed",
    statusLabel: "Confirmada",
    tone: "info",
    day: "2026-11-10",
    dayLabel: "",
    timeRange: "",
    startMinutes: 0,
    endMinutes: 0,
    startsAt: Date.parse("2026-11-10T16:00:00Z"),
    amount: "",
    priceMinor: 65000,
    address: "Colima 214",
    staffId: 1,
    staffName: "Ana",
    offeringName: "Limpieza general",
    customerName: "Cliente Prueba",
    customerEmail: "test@test.com",
    ...over,
  };
}

const rows = [
  row(1, { day: "2026-11-02", startsAt: Date.parse("2026-11-02T16:00:00Z"), customerName: "Zoe", priceMinor: 90000 }),
  row(2, { day: "2026-11-20", startsAt: Date.parse("2026-11-20T16:00:00Z"), customerName: "álvaro", staffId: 2, staffName: "Luis" }),
  row(3, { day: "2026-11-10", offeringName: "Limpieza profunda", customerName: "Beto", priceMinor: 120000 }),
];

describe("booking table sort", () => {
  it("defaults to newest first", () => {
    expect(sortBookings(rows, DEFAULT_BOOKING_SORT).map((r) => r.id)).toEqual([2, 3, 1]);
  });
  it("sorts text with Spanish collation, ignoring accents and case", () => {
    expect(sortBookings(rows, { key: "cliente", dir: "asc" }).map((r) => r.customerName)).toEqual(["álvaro", "Beto", "Zoe"]);
  });
  it("sorts amounts numerically and breaks ties newest first", () => {
    expect(sortBookings(rows, { key: "importe", dir: "asc" }).map((r) => r.id)).toEqual([2, 1, 3]);
  });
  it("toggles the active column and starts a new one in its natural direction", () => {
    expect(nextSort(DEFAULT_BOOKING_SORT, "fecha")).toEqual({ key: "fecha", dir: "asc" });
    expect(nextSort(DEFAULT_BOOKING_SORT, "cliente")).toEqual({ key: "cliente", dir: "asc" });
    expect(nextSort(DEFAULT_BOOKING_SORT, "importe")).toEqual({ key: "importe", dir: "desc" });
  });
});

describe("booking table filters", () => {
  it("filters by person, service and an inclusive business-day range", () => {
    expect(filterBookings(rows, { ...NO_BOOKING_FILTERS, staffId: 2 }).map((r) => r.id)).toEqual([2]);
    expect(filterBookings(rows, { ...NO_BOOKING_FILTERS, offeringName: "Limpieza profunda" }).map((r) => r.id)).toEqual([3]);
    expect(filterBookings(rows, { ...NO_BOOKING_FILTERS, from: "2026-11-02", to: "2026-11-10" }).map((r) => r.id)).toEqual([1, 3]);
  });
  it("combines filters with the search box", () => {
    expect(filterBookings(rows, { ...NO_BOOKING_FILTERS, from: "2026-11-05", search: "beto" }).map((r) => r.id)).toEqual([3]);
    expect(filterBookings(rows, { ...NO_BOOKING_FILTERS, search: "#2" }).map((r) => r.id)).toEqual([2]);
  });
  it("counts toolbar filters only", () => {
    expect(activeFilterCount({ ...NO_BOOKING_FILTERS, search: "x" })).toBe(0);
    expect(activeFilterCount({ ...NO_BOOKING_FILTERS, staffId: 1, from: "2026-11-01" })).toBe(2);
  });
});
