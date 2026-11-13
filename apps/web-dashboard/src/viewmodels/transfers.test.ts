import type { Schemas } from "@repo/api-client";
import { describe, expect, it } from "vitest";
import { toTransferRow } from "./transfers";

const transfer: Schemas["AdminTransferOut"] = {
  id: 7,
  booking_id: 40,
  subscription_cycle_id: null,
  method: "spei",
  provider: "spei",
  provider_ref: "K7M2QX9A",
  status: "pending",
  amount_minor: 45000,
  currency: "MXN",
  created_at: "2026-11-11T16:00:00Z",
  transfer: {
    clabe: "000000000000000000",
    bank: "Banco de prueba",
    beneficiary: "Cuenta de prueba",
    reference: "K7M2QX9A",
    amount_minor: 45000,
    currency: "MXN",
  },
  customer_id: 3,
  subscription_id: null,
  pay_by: "2026-11-12T16:00:00Z",
};

const lookups = { customer: () => ({ name: "Cliente Prueba", email: "test@test.com" }) };

describe("pending transfers", () => {
  it("shows who pays, how much, the concept to look for and the deadline", () => {
    expect(toTransferRow(transfer, lookups)).toMatchObject({
      customerName: "Cliente Prueba",
      amount: "$450.00",
      reference: "K7M2QX9A",
      target: { label: "Reserva 40", to: { path: "/reservas", query: { reserva: "40" } } },
    });
    expect(toTransferRow(transfer, lookups).payBy).not.toBeNull();
  });

  it("links a plan cycle to its subscription and flags a lapsed hold", () => {
    const plan = { ...transfer, booking_id: null, subscription_cycle_id: 9, subscription_id: 4, pay_by: null };
    expect(toTransferRow(plan, lookups)).toMatchObject({ target: { label: "Suscripción 4" }, payBy: null });
  });
});
