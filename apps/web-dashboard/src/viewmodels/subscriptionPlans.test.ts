import type { Schemas } from "@repo/api-client";
import { describe, expect, it } from "vitest";
import { formatDuration, planEconomics, planFamilies } from "./subscriptionPlans";

function version(id: number, overrides: Partial<Schemas["AdminSubscriptionPlanOut"]> = {}): Schemas["AdminSubscriptionPlanOut"] {
  return {
    id,
    name: `Plan ${id}`,
    description: "",
    days_per_week: 1,
    visits_per_cycle: 4,
    visit_duration_minutes: 180,
    price_minor: 100_000,
    staff_earning_minor: 10_000,
    currency: "MXN",
    terms: "x",
    is_active: true,
    replaces_id: null,
    created_at: "2026-11-10T00:00:00Z",
    ...overrides,
  };
}

describe("planFamilies", () => {
  it("groups a chain of versions under its latest one, newest history first", () => {
    const families = planFamilies([
      version(1, { is_active: false }),
      version(2, { is_active: false, replaces_id: 1 }),
      version(3, { replaces_id: 2 }),
    ]);
    expect(families.map((f) => [f.current.id, f.previous.map((p) => p.id)])).toEqual([[3, [2, 1]]]);
  });

  it("lists visible plans first, then by days per week and price", () => {
    const families = planFamilies([
      version(1, { is_active: false, days_per_week: 1 }),
      version(2, { days_per_week: 2, price_minor: 300_000 }),
      version(3, { days_per_week: 1, price_minor: 200_000 }),
      version(4, { days_per_week: 1, price_minor: 150_000 }),
    ]);
    expect(families.map((f) => f.current.id)).toEqual([4, 3, 2, 1]);
  });
});

describe("planEconomics", () => {
  it("counts four visits per chosen weekday and splits the monthly price", () => {
    expect(planEconomics({ days_per_week: 2, price_minor: 320_000, staff_earning_minor: 15_000 })).toEqual({
      visits: 8,
      perVisitMinor: 40_000,
      staffMonthlyMinor: 120_000,
      marginMonthlyMinor: 200_000,
    });
  });

  it("reports a negative margin when the cleaner's pay exceeds the price", () => {
    expect(planEconomics({ days_per_week: 1, price_minor: 10_000, staff_earning_minor: 5_000 }).marginMonthlyMinor).toBe(-10_000);
  });
});

describe("formatDuration", () => {
  it("drops the zero part", () => {
    expect([formatDuration(45), formatDuration(180), formatDuration(150)]).toEqual(["45 min", "3 h", "2 h 30 min"]);
  });
});
