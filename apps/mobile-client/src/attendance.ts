import type { Schemas } from "@repo/api-client";
import { useState } from "react";
import { Linking, Platform } from "react-native";
import { api, errorMessage } from "./api";
import { captureAttendance } from "./gps";
import type { Tone } from "./ui";

type Booking = Schemas["BookingOut"];

const CAPTURE_MESSAGES: Record<string, { text: string; tone: Tone }> = {
  captured: { text: "Ubicación registrada.", tone: "success" },
  permission_denied: { text: "Sin permiso de ubicación. Se registró sin GPS y administración lo revisará.", tone: "warning" },
  unavailable: { text: "No se pudo obtener la ubicación. Se registró sin GPS y administración lo revisará.", tone: "warning" },
};

export const canAttend = (b: Booking) => b.status === "confirmed" || b.status === "in_progress";
export const attendLabel = (b: Booking) => (b.status === "confirmed" ? "Registrar entrada" : "Registrar salida");

/** Check-in / check-out with a single foreground GPS capture; reports the outcome as a notice. */
export function useAttendance(onDone: () => void) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: Tone } | null>(null);

  async function attend(b: Booking) {
    setBusyId(b.id);
    const body = await captureAttendance();
    const path = b.status === "confirmed" ? "/bookings/{booking_id}/check-in" : "/bookings/{booking_id}/check-out";
    const r = await api.POST(path, { params: { path: { booking_id: b.id } }, body }).catch(() => null);
    setBusyId(null);
    if (!r) setNotice({ text: "Sin conexión: no se pudo enviar. Avisa a administración para registrarlo manualmente.", tone: "danger" });
    else if (r.error) setNotice({ text: errorMessage(r.error), tone: "danger" });
    else setNotice(CAPTURE_MESSAGES[body.capture_status] ?? null);
    onDone();
  }

  return { attend, busyId, notice };
}

/** Opens the device's maps app on the service address. */
export function openDirections(address: string) {
  const q = encodeURIComponent(address);
  const url = Platform.OS === "ios" ? `maps://?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
  void Linking.openURL(url);
}
