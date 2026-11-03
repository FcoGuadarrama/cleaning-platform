import type { Schemas } from "@repo/api-client";
import { Link } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { api, errorMessage } from "../../src/api";
import { BOOKING_LABELS, formatDateTime } from "../../src/format";
import { captureAttendance } from "../../src/gps";
import { useSession } from "../../src/session";
import { Button, Card, StateView } from "../../src/ui";
import { useResource } from "../../src/useResource";

const CAPTURE_MESSAGES: Record<string, string> = {
  captured: "Ubicación registrada.",
  permission_denied: "Sin permiso de ubicación. Se registró sin GPS y administración lo revisará.",
  unavailable: "No se pudo obtener la ubicación. Se registró sin GPS y administración lo revisará.",
};

export default function StaffHome() {
  const bookings = useResource(() => api.GET("/bookings"));
  const { logout } = useSession();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function attend(b: Schemas["BookingOut"]) {
    setBusyId(b.id);
    const body = await captureAttendance();
    const path = b.status === "confirmed" ? "/bookings/{booking_id}/check-in" : "/bookings/{booking_id}/check-out";
    const r = await api.POST(path, { params: { path: { booking_id: b.id } }, body }).catch(() => null);
    setBusyId(null);
    if (!r) setNotice("Sin conexión: no se pudo enviar. Avisa a administración para registrarlo manualmente.");
    else if (r.error) setNotice(errorMessage(r.error));
    else setNotice(CAPTURE_MESSAGES[body.capture_status] ?? null);
    void bookings.refresh();
  }

  return (
    <View className="flex-1 bg-background">
      {notice ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="m-4 rounded-md bg-surface p-3 text-md text-text">{notice}</Text> : null}
      <StateView loading={bookings.loading} error={bookings.error} empty={!bookings.data?.length} emptyText="No tienes servicios asignados." onRetry={bookings.refresh}>
        <FlatList
          data={bookings.data ?? []}
          keyExtractor={(b) => String(b.id)}
          contentContainerClassName="gap-3 p-4"
          renderItem={({ item }) => (
            <Card>
              <Text className="text-md font-semibold text-text">{formatDateTime(item.starts_at)}</Text>
              <Text className="text-md text-text">{item.address}</Text>
              <Text className="text-sm text-text-muted">{BOOKING_LABELS[item.status]}</Text>
              {item.status === "confirmed" || item.status === "in_progress" ? (
                <Button
                  label={item.status === "confirmed" ? "Registrar entrada" : "Registrar salida"}
                  hint="Usa tu ubicación actual una sola vez"
                  busy={busyId === item.id}
                  onPress={() => attend(item)}
                />
              ) : null}
            </Card>
          )}
        />
      </StateView>
      <View className="flex-row justify-between p-4">
        <Link href="/(staff)/earnings" className="py-3 text-md text-primary">Ganancias de la semana</Link>
        <Pressable accessibilityRole="button" onPress={logout} className="min-h-11 justify-center"><Text className="text-md text-text-muted">Cerrar sesión</Text></Pressable>
      </View>
    </View>
  );
}
