import type { Schemas } from "@repo/api-client";
import { useState } from "react";
import { Text, View } from "react-native";
import { api, errorMessage } from "../../src/api";
import { DateBlock } from "../../src/DateBlock";
import { BOOKING_LABELS, BOOKING_TONES, formatLongDay, formatTime, sentenceCase } from "../../src/format";
import { captureAttendance } from "../../src/gps";
import { Icon } from "../../src/icons";
import { color } from "../../src/theme";
import { Badge, Button, Group, Notice, Page, Section, StateView, type Tone } from "../../src/ui";
import { useResource } from "../../src/useResource";

type Booking = Schemas["BookingOut"];

const CAPTURE_MESSAGES: Record<string, { text: string; tone: Tone }> = {
  captured: { text: "Ubicación registrada.", tone: "success" },
  permission_denied: { text: "Sin permiso de ubicación. Se registró sin GPS y administración lo revisará.", tone: "warning" },
  unavailable: { text: "No se pudo obtener la ubicación. Se registró sin GPS y administración lo revisará.", tone: "warning" },
};

const actionable = (b: Booking) => b.status === "confirmed" || b.status === "in_progress";

/** The service to act on now: one in progress, otherwise the earliest confirmed. */
function NextService({ booking, busy, onAttend }: { booking: Booking; busy: boolean; onAttend: () => void }) {
  const started = booking.status === "in_progress";
  return (
    <View className="gap-5 rounded-xl bg-primary p-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-on-primary opacity-80">{started ? "En curso" : "Siguiente servicio"}</Text>
        <Text className="text-sm text-on-primary opacity-80">{sentenceCase(formatLongDay(booking.starts_at))}</Text>
      </View>
      <View className="gap-1">
        <Text className="text-2xl font-bold tracking-[-0.6px] text-on-primary">
          {formatTime(booking.starts_at)} a {formatTime(booking.ends_at)}
        </Text>
        <View className="flex-row items-start gap-2">
          <Icon name="pin" size={20} color={color["on-primary"]} />
          <Text className="flex-1 text-md text-on-primary">{booking.address}</Text>
        </View>
      </View>
      <Button
        variant="secondary"
        icon={started ? "check" : "pin"}
        label={started ? "Registrar salida" : "Registrar entrada"}
        hint="Usa tu ubicación actual una sola vez"
        busy={busy}
        onPress={onAttend}
      />
    </View>
  );
}

export default function StaffHome() {
  const bookings = useResource(() => api.GET("/bookings"));
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
    void bookings.refresh();
  }

  const sorted = [...(bookings.data ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const next = sorted.find((b) => b.status === "in_progress") ?? sorted.find((b) => b.status === "confirmed");
  const rest = sorted.filter((b) => b.id !== next?.id);

  return (
    <Page title="Mis servicios" onRefresh={bookings.refresh}>
      {notice ? <Notice tone={notice.tone} icon={notice.tone === "success" ? "check" : "alert"} text={notice.text} /> : null}
      <StateView
        loading={bookings.loading}
        error={bookings.error}
        empty={!sorted.length}
        emptyIcon="calendar"
        emptyTitle="No tienes servicios asignados"
        emptyText="Cuando administración te asigne una visita aparecerá aquí."
        onRetry={bookings.refresh}
      >
        {next ? <NextService booking={next} busy={busyId === next.id} onAttend={() => attend(next)} /> : null}
        {rest.length ? (
          <Section title="Agenda">
            <Group>
              {rest.map((b) => (
                <View key={b.id} className="gap-3 px-4 py-3">
                  <View className="flex-row items-center gap-4">
                    <DateBlock iso={b.starts_at} />
                    <View className="flex-1 gap-1">
                      <Text className="text-md font-semibold text-text">{formatTime(b.starts_at)} a {formatTime(b.ends_at)}</Text>
                      <Text numberOfLines={2} className="text-sm text-text-muted">{b.address}</Text>
                    </View>
                    <Badge label={BOOKING_LABELS[b.status]} tone={BOOKING_TONES[b.status]} />
                  </View>
                  {actionable(b) ? (
                    <Button
                      variant="secondary"
                      label={b.status === "confirmed" ? "Registrar entrada" : "Registrar salida"}
                      hint="Usa tu ubicación actual una sola vez"
                      busy={busyId === b.id}
                      onPress={() => attend(b)}
                    />
                  ) : null}
                </View>
              ))}
            </Group>
          </Section>
        ) : null}
      </StateView>
    </Page>
  );
}
