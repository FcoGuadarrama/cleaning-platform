import type { Schemas } from "@repo/api-client";

export const BUSINESS_TZ = "America/Mexico_City";

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(minor / 100);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: BUSINESS_TZ }).format(
    new Date(iso),
  );
}

export function toMinor(input: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(input.trim())) return null;
  const [whole, frac = ""] = input.trim().split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

const BOOKING_LABELS: Record<Schemas["BookingStatus"], string> = {
  held: "Reservada (pago pendiente)",
  expired: "Expirada",
  confirmed: "Confirmada",
  in_progress: "En curso",
  pending_review: "Revisión pendiente",
  completed: "Completada",
  disputed: "En disputa",
  cancelled: "Cancelada",
};

export interface BookingRow {
  id: number;
  when: string;
  status: string;
  amount: string;
  address: string;
}

export function toBookingRow(b: Schemas["BookingOut"]): BookingRow {
  return {
    id: b.id,
    when: formatDateTime(b.starts_at),
    status: BOOKING_LABELS[b.status],
    amount: formatMoney(b.price_minor, b.currency),
    address: b.address,
  };
}

export function mondayOf(date: Date): string {
  const local = new Date(date.toLocaleString("en-US", { timeZone: BUSINESS_TZ }));
  const day = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - day);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}
