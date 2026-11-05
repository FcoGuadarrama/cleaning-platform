import type { Schemas } from "@repo/api-client";
import { useState } from "react";
import { Text, View } from "react-native";
import { api, errorMessage } from "../../src/api";
import { DateBlock } from "../../src/DateBlock";
import { BOOKING_LABELS, BOOKING_TONES, formatLongDay, formatTime, sentenceCase } from "../../src/format";
import { captureAttendance } from "../../src/gps";
import { Icon } from "../../src/icons";
import { useSession } from "../../src/session";
import { alpha, color } from "../../src/theme";
import { Badge, Button, Card, HeroPage, HeroText, IconTile, Notice, SectionHeader, StateView, type Tone } from "../../src/ui";
import { useResource } from "../../src/useResource";

type Booking = Schemas["BookingOut"];

const CAPTURE_MESSAGES: Record<string, { text: string; tone: Tone }> = {
  captured: { text: "Ubicación registrada.", tone: "success" },
  permission_denied: { text: "Sin permiso de ubicación. Se registró sin GPS y administración lo revisará.", tone: "warning" },
  unavailable: { text: "No se pudo obtener la ubicación. Se registró sin GPS y administración lo revisará.", tone: "warning" },
};

const actionable = (b: Booking) => b.status === "confirmed" || b.status === "in_progress";

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 gap-0.5 rounded-xl px-4 py-3" style={{ backgroundColor: alpha(color["on-primary"], 0.14) }}>
      <Text className="text-xl font-extrabold text-on-primary">{value}</Text>
      <Text className="text-xs font-semibold text-on-primary opacity-80">{label}</Text>
    </View>
  );
}

/** The service to act on now: one in progress, otherwise the earliest confirmed. */
function NextService({ booking, busy, onAttend }: { booking: Booking; busy: boolean; onAttend: () => void }) {
  const started = booking.status === "in_progress";
  return (
    <Card className="gap-5 p-5">
      <View className="flex-row items-center justify-between">
        <Badge label={started ? "En curso" : "Siguiente servicio"} tone={started ? "primary" : "success"} />
        <Text className="text-sm font-medium text-text-muted">{sentenceCase(formatLongDay(booking.starts_at))}</Text>
      </View>
      <View className="gap-3">
        <Text className="text-2xl font-extrabold tracking-[-0.8px] text-text">
          {formatTime(booking.starts_at)} <Text className="text-xl font-bold text-text-muted">a {formatTime(booking.ends_at)}</Text>
        </Text>
        <View className="flex-row items-center gap-3 rounded-lg bg-surface p-3">
          <IconTile icon="pin" size={40} />
          <Text className="flex-1 text-md font-medium text-text">{booking.address}</Text>
        </View>
      </View>
      <Button
        icon={started ? "check" : "pin"}
        label={started ? "Registrar salida" : "Registrar entrada"}
        hint="Usa tu ubicación actual una sola vez"
        busy={busy}
        onPress={onAttend}
      />
    </Card>
  );
}

export default function StaffHome() {
  const { user } = useSession();
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
  const pending = sorted.filter(actionable).length;
  const done = sorted.filter((b) => b.status === "completed" || b.status === "pending_review").length;
  const firstName = user?.full_name.split(/\s+/)[0] ?? "";

  return (
    <HeroPage
      onRefresh={bookings.refresh}
      hero={
        <View className="gap-5">
          <HeroText kicker={`Hola, ${firstName}`} title="Tus servicios" />
          <View className="flex-row gap-3">
            <HeroStat value={pending} label="Por hacer" />
            <HeroStat value={done} label="Terminados" />
          </View>
        </View>
      }
    >
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
        <View className="gap-7">
          {next ? <NextService booking={next} busy={busyId === next.id} onAttend={() => attend(next)} /> : null}
          {rest.length ? (
            <View className="gap-3">
              <SectionHeader title="Agenda" detail={`${rest.length} más`} />
              {rest.map((b) => (
                <Card key={b.id} className="gap-3">
                  <View className="flex-row items-center gap-4">
                    <DateBlock iso={b.starts_at} />
                    <View className="flex-1 gap-1">
                      <Text className="text-md font-bold text-text">{formatTime(b.starts_at)} a {formatTime(b.ends_at)}</Text>
                      <View className="flex-row items-center gap-1">
                        <Icon name="pin" size={14} color={color["text-muted"]} />
                        <Text numberOfLines={1} className="flex-1 text-sm text-text-muted">{b.address}</Text>
                      </View>
                      <Badge label={BOOKING_LABELS[b.status]} tone={BOOKING_TONES[b.status]} />
                    </View>
                  </View>
                  {actionable(b) ? (
                    <Button
                      variant="soft"
                      label={b.status === "confirmed" ? "Registrar entrada" : "Registrar salida"}
                      hint="Usa tu ubicación actual una sola vez"
                      busy={busyId === b.id}
                      onPress={() => attend(b)}
                    />
                  ) : null}
                </Card>
              ))}
            </View>
          ) : null}
        </View>
      </StateView>
    </HeroPage>
  );
}
