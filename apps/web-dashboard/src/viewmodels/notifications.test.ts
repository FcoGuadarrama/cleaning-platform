import type { Schemas } from "@repo/api-client";
import { describe, expect, it } from "vitest";
import { notificationLink, toNotificationItem, unreadLabel } from "./notifications";

const notice: Schemas["NotificationOut"] = {
  id: 9,
  category: "operations",
  kind: "payment.transfer_pending",
  title: "Transferencia por revisar",
  body: "Referencia K7M2QX9A · $450.00 MXN",
  data: { payment_id: 7 },
  created_at: "2026-11-13T16:00:00Z",
  read_at: null,
};

describe("notificationLink", () => {
  it("sends each admin notice to the page that resolves it", () => {
    expect(notificationLink(notice)).toBe("/transferencias");
    expect(notificationLink({ kind: "attendance.exception_opened", data: { booking_id: 4 } })).toBe("/asistencia");
    expect(notificationLink({ kind: "payment.needs_refund", data: { payment_id: 7, booking_id: 40 } })).toEqual({
      path: "/reservas",
      query: { reserva: "40", estado: "todas" },
    });
    expect(notificationLink({ kind: "subscription.renewal_blocked", data: { subscription_id: 3 } })).toEqual({
      path: "/suscripciones",
      query: { filtro: "todas" },
    });
    expect(notificationLink({ kind: "unknown", data: {} })).toBeNull();
  });
});

describe("toNotificationItem", () => {
  it("marks unread notices and formats the time in the business zone", () => {
    const item = toNotificationItem(notice);
    expect(item.unread).toBe(true);
    expect(item.createdAt).toContain("10:00");
    expect(toNotificationItem({ ...notice, read_at: "2026-11-13T17:00:00Z" }).unread).toBe(false);
  });

  it("caps the badge", () => {
    expect([unreadLabel(3), unreadLabel(12)]).toEqual(["3", "9+"]);
  });
});
