import type { Schemas } from "@repo/api-client";
import { describe, expect, it } from "vitest";
import { currentCycle, scheduleLabel, toSubscriptionRow } from "./contractedSubscriptions";

function visit(id: number, status: Schemas["BookingStatus"]): Schemas["BookingOut"] {
  return {
    id,
    customer_id: 3,
    staff_id: 1,
    offering_id: null,
    subscription_cycle_id: 10,
    starts_at: "2026-11-17T16:00:00Z",
    ends_at: "2026-11-17T19:00:00Z",
    status,
    hold_expires_at: null,
    price_minor: 0,
    currency: "MXN",
    address: "Colima 214",
    address_id: 1,
  };
}

function cycle(id: number, status: Schemas["CycleStatus"], visits: Schemas["BookingOut"][]): Schemas["SubscriptionCycleOut"] {
  return { id, sequence: id, starts_on: "2026-11-17", ends_on: "2026-12-14", status, hold_expires_at: null, price_minor: 160000, currency: "MXN", visits };
}

const subscription: Schemas["AdminSubscriptionOut"] = {
  id: 5,
  status: "active",
  plan_id: 2,
  plan_name: "Semanal",
  staff_id: 1,
  customer_id: 3,
  weekdays: [1, 3],
  visit_start: "10:00:00",
  address: "Colima 214",
  address_id: 1,
  days_per_week: 2,
  visits_per_cycle: 8,
  visit_duration_minutes: 180,
  price_minor: 160000,
  staff_earning_minor: 15000,
  currency: "MXN",
  terms: "Condiciones de prueba.",
  terms_accepted_at: "2026-11-10T20:00:00Z",
  created_at: "2026-11-10T20:00:00Z",
  renews_on: "2026-12-15",
  cycles: [cycle(10, "confirmed", [visit(1, "completed"), visit(2, "confirmed")])],
};

const lookups = {
  staffName: () => "Ana",
  customer: (id: number) => (id === 3 ? { name: "Cliente Prueba", email: "test@test.com" } : { name: `Cliente #${id}`, email: null }),
};

describe("contracted subscriptions", () => {
  it("summarises the current cycle for the list", () => {
    expect(toSubscriptionRow(subscription, lookups)).toMatchObject({
      customerName: "Cliente Prueba",
      staffName: "Ana",
      schedule: "Mar, Jue · 10:00",
      statusLabel: "Activa",
      visitsDone: 1,
      visitsTotal: 2,
      renews: "Mar 15 de dic",
    });
  });

  it("uses the paid cycle over a newer pending one, and the pending one before any payment", () => {
    const renewal = cycle(11, "held", []);
    expect(currentCycle({ ...subscription, cycles: [...subscription.cycles, renewal] })?.id).toBe(10);
    expect(currentCycle({ ...subscription, status: "held", cycles: [renewal] })?.id).toBe(11);
  });

  it("formats weekdays in order with the local time", () => {
    expect(scheduleLabel([0, 2, 4], "08:30:00")).toBe("Lun, Mié, Vie · 08:30");
  });
});
