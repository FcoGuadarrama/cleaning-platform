import type { Schemas } from "@repo/api-client";
import type { RouteLocationRaw } from "vue-router";
import { formatDateTime } from "./format";

type Notification = Schemas["NotificationOut"];

export interface NotificationItem {
  id: number;
  title: string;
  body: string;
  unread: boolean;
  createdAt: string;
  /** The page that resolves it; null when there is nothing to open. */
  to: RouteLocationRaw | null;
}

/** Admin notices open the queue that resolves them, or the booking / subscription they are about. */
export function notificationLink(n: Pick<Notification, "kind" | "data">): RouteLocationRaw | null {
  if (n.kind === "payment.transfer_pending") return "/transferencias";
  if (n.kind === "attendance.exception_opened") return "/asistencia";
  if (n.data.booking_id !== undefined) return { path: "/reservas", query: { reserva: String(n.data.booking_id), estado: "todas" } };
  if (n.data.subscription_id !== undefined) return { path: "/suscripciones", query: { filtro: "todas" } };
  return null;
}

export function toNotificationItem(n: Notification): NotificationItem {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    unread: n.read_at === null,
    createdAt: formatDateTime(n.created_at),
    to: notificationLink(n),
  };
}

export const unreadLabel = (count: number) => (count > 9 ? "9+" : String(count));
