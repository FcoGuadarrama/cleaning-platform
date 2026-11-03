import type { Schemas } from "@repo/api-client";
import * as Location from "expo-location";

type AttendanceRequest = Schemas["AttendanceRequest"];

/**
 * Foreground-only capture at check-in/out. Failures are reported as failures (never as a success)
 * so the server opens an administrative exception.
 */
export async function captureAttendance(): Promise<AttendanceRequest> {
  const occurred_at = new Date().toISOString();
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return { capture_status: "permission_denied", occurred_at };
  }
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    if (pos.coords.accuracy == null) return { capture_status: "unavailable", occurred_at };
    return {
      capture_status: "captured",
      occurred_at,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy_m: pos.coords.accuracy,
    };
  } catch {
    return { capture_status: "unavailable", occurred_at };
  }
}
