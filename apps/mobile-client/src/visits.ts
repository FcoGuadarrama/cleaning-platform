import type { Schemas } from "@repo/api-client";
import { formatMoney } from "./format";
import type { IconName } from "./icons";

type Status = Schemas["BookingStatus"];

/** Visits still ahead of the customer (payment pending, confirmed or under way). */
export const UPCOMING = new Set<Status>(["held", "confirmed", "in_progress"]);

const SERVICE_ICONS: IconName[] = ["broom", "bucket", "spray", "home"];

/** Offerings carry no icon yet, so each gets a stable one by position. */
export const serviceIcon = (index: number) => SERVICE_ICONS[index % SERVICE_ICONS.length]!;

/** Cleaner the customer booked most often, as the "usual professional" until the product stores one. */
export function usualStaffId(bookings: Schemas["BookingOut"][]) {
  const counts = new Map<number, number>();
  for (const b of bookings) if (b.status !== "expired" && b.status !== "cancelled") counts.set(b.staff_id, (counts.get(b.staff_id) ?? 0) + 1);
  let best: number | undefined;
  for (const [id, n] of counts) if (best === undefined || n > counts.get(best)!) best = id;
  return best;
}

export const isPlanVisit = (b: Schemas["BookingOut"]) => b.subscription_cycle_id !== null;

/** What the visit is: its service name, or the plan for a subscription visit. */
export const visitTitle = (b: Schemas["BookingOut"], offering?: Schemas["OfferingOut"]) =>
  isPlanVisit(b) ? "Visita de tu plan" : offering?.name;

/** Price line: a subscription visit is paid with its monthly cycle. */
export const visitPrice = (b: Schemas["BookingOut"]) => (isPlanVisit(b) ? "Incluida en tu plan" : formatMoney(b.price_minor, b.currency));
