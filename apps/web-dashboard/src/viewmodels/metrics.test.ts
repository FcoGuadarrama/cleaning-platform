import type { Schemas } from "@repo/api-client";
import { describe, expect, it } from "vitest";
import { computeMetrics, formatDelta, niceTicks } from "./metrics";

function booking(id: number, startsAt: string, status: Schemas["BookingStatus"], price = 10_000): Schemas["BookingOut"] {
  const end = new Date(Date.parse(startsAt) + 2 * 3_600_000).toISOString();
  return {
    id,
    customer_id: 1,
    staff_id: id % 2,
    offering_id: 1,
    starts_at: startsAt,
    ends_at: end,
    status,
    hold_expires_at: null,
    price_minor: price,
    currency: "MXN",
    address: "Calle 1",
    address_id: null,
  };
}

describe("dashboard metrics", () => {
  const data = [
    booking(1, "2026-11-05T15:00:00Z", "completed"),
    booking(2, "2026-11-04T15:00:00Z", "confirmed", 20_000),
    booking(3, "2026-11-04T16:00:00Z", "cancelled"),
    booking(4, "2026-11-03T15:00:00Z", "held"),
    booking(5, "2026-10-28T15:00:00Z", "completed", 15_000),
  ];

  it("counts only paid statuses as sales and drops void ones from bookings", () => {
    const m = computeMetrics(data, "2026-11-05", "7");
    expect(m.sales.value).toBe(30_000);
    expect(m.bookings.value).toBe(3);
    expect(m.avgTicket.value).toBe(15_000);
    expect(m.hours.value).toBe(4);
  });

  it("compares against the previous period of the same length", () => {
    const m = computeMetrics(data, "2026-11-05", "7");
    expect(m.sales.previous).toBe(15_000);
    expect(m.sales.delta).toBeCloseTo(1);
    expect(m.buckets).toHaveLength(7);
  });

  it("buckets by week for the 90-day range", () => {
    const m = computeMetrics(data, "2026-11-05", "90");
    expect(m.buckets.every((b) => new Date(`${b.key}T12:00:00Z`).getUTCDay() === 1)).toBe(true);
    expect(m.sales.value).toBe(45_000);
  });

  it("formats deltas and nice ticks", () => {
    expect(formatDelta(0.123)).toBe("+12 %");
    expect(formatDelta(-0.05)).toBe("-5 %");
    expect(niceTicks(870)).toEqual([0, 250, 500, 750, 1000]);
  });
});
