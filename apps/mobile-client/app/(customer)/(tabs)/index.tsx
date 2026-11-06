import type { Schemas } from "@repo/api-client";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { HorizontalScroll } from "../../../src/HorizontalScroll";
import { api } from "../../../src/api";
import { DateBlock } from "../../../src/DateBlock";
import { useNextSlots } from "../../../src/availability";
import { BOOKING_LABELS, BOOKING_TONES, formatDuration, formatMoney, formatRelativeDay, formatTime } from "../../../src/format";
import { Icon, type IconName } from "../../../src/icons";
import { Rise, Skeleton } from "../../../src/motion";
import { useSession } from "../../../src/session";
import { color, shadow } from "../../../src/theme";
import { Avatar, Badge, Card, HeroPage, HeroText, IconTile, SectionHeader, SkeletonCards, StateView, toneFor } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

const SERVICE_ICONS: IconName[] = ["home", "sparkle", "drop", "broom"];
const ACTIVE = new Set(["held", "confirmed", "in_progress"]);

function NextVisit({ booking, staffName }: { booking: Schemas["BookingOut"]; staffName?: string }) {
  return (
    <Card onPress={() => router.push({ pathname: "/(customer)/booking/[id]", params: { id: String(booking.id) } })} accessibilityLabel="Ver tu próxima visita">
      <View className="flex-row items-center gap-4">
        <DateBlock iso={booking.starts_at} size="lg" />
        <View className="flex-1 gap-1">
          <Text className="text-sm font-semibold text-text-muted">Tu próxima visita</Text>
          <Text className="text-lg font-bold text-text">
            {formatTime(booking.starts_at)}
            {staffName ? <Text className="font-medium text-text-muted"> con {staffName}</Text> : null}
          </Text>
          <Badge label={BOOKING_LABELS[booking.status]} tone={BOOKING_TONES[booking.status]} />
        </View>
        <Icon name="chevron" size={20} color={color["text-muted"]} />
      </View>
    </Card>
  );
}

function PlanVisit({ returning }: { returning: boolean }) {
  return (
    <Card>
      <View className="flex-row items-center gap-4">
        <IconTile icon="sparkle" tone="accent" size={56} />
        <View className="flex-1 gap-1">
          <Text className="text-lg font-bold text-text">{returning ? "Agenda tu próxima limpieza" : "Agenda tu primera limpieza"}</Text>
          <Text className="text-sm text-text-muted">Elige un servicio y a la persona que quieres que te visite.</Text>
        </View>
      </View>
    </Card>
  );
}

function ServiceTile({ offering, index, selected, onPress }: { offering: Schemas["OfferingOut"]; index: number; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${offering.name}, ${formatMoney(offering.price_minor, offering.currency)}`}
      onPress={onPress}
      style={shadow(selected ? "2" : "1")}
      className={`w-40 gap-3 rounded-xl border-2 bg-surface-raised p-4 active:opacity-90 ${selected ? "border-primary" : "border-surface-raised"}`}
    >
      <View className="flex-row items-start justify-between">
        <IconTile icon={SERVICE_ICONS[index % SERVICE_ICONS.length]!} tone={toneFor(index)} />
        {selected ? (
          <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
            <Icon name="check" size={14} color={color["on-primary"]} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <View className="gap-0.5">
        <Text numberOfLines={2} className="min-h-[44px] text-md font-bold leading-[22px] text-text">{offering.name}</Text>
        <Text className="text-sm text-text-muted">{formatDuration(offering.duration_minutes)}</Text>
      </View>
      <Text className="text-lg font-extrabold text-text">{formatMoney(offering.price_minor, offering.currency)}</Text>
    </Pressable>
  );
}

/** Next open slot line: real availability, so the card answers "when could they come?". */
function NextSlot({ slot }: { slot: { starts_at: string } | null | undefined }) {
  if (slot === undefined) return <Skeleton className="h-8 w-44 rounded-full" />;
  if (slot === null) return <Text className="text-sm text-text-muted">Sin horarios libres esta semana</Text>;
  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-success-soft px-3 py-1.5">
      <Icon name="clock" size={15} color={color.success} strokeWidth={2.2} />
      <Text className="text-sm font-bold text-success">
        {formatRelativeDay(slot.starts_at)}, {formatTime(slot.starts_at)}
      </Text>
    </View>
  );
}

function StaffCard({ staff, slot, onPress }: { staff: Schemas["StaffProfileOut"]; slot: { starts_at: string } | null | undefined; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`Ver perfil de ${staff.display_name}`}>
      <View className="flex-row gap-4">
        <Avatar name={staff.display_name} tone={toneFor(staff.id)} size="lg" />
        <View className="flex-1 gap-1">
          <Text className="text-lg font-bold text-text">{staff.display_name}</Text>
          {staff.bio ? <Text numberOfLines={2} className="text-sm text-text-muted">{staff.bio}</Text> : null}
          <View className="mt-1 flex-row items-center gap-1.5">
            <Icon name="star" size={16} color={color.accent} filled strokeWidth={1.5} />
            <Text className="text-xs font-semibold text-text-muted">Aún sin reseñas</Text>
          </View>
        </View>
      </View>
      <View className="mt-4 flex-row items-center justify-between border-t border-border/50 pt-3">
        <View className="gap-1">
          <Text className="text-xs font-semibold text-text-muted">Próximo horario libre</Text>
          <NextSlot slot={slot} />
        </View>
        <View className="flex-row items-center gap-1 rounded-full bg-primary-soft py-2 pl-4 pr-3">
          <Text className="text-sm font-bold text-primary">Ver perfil</Text>
          <Icon name="chevron" size={16} color={color.primary} strokeWidth={2.4} />
        </View>
      </View>
    </Card>
  );
}

export default function Home() {
  const { user } = useSession();
  const staff = useResource(() => api.GET("/staff"));
  const offerings = useResource(() => api.GET("/offerings"));
  const bookings = useResource(() => api.GET("/bookings"));
  const [offeringId, setOfferingId] = useState<number | null>(null);

  const staffName = new Map((staff.data ?? []).map((s) => [s.id, s.display_name]));
  const next = [...(bookings.data ?? [])].filter((b) => ACTIVE.has(b.status)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const firstName = user?.full_name.split(/\s+/)[0] ?? "";

  function refresh() {
    void staff.refresh();
    void offerings.refresh();
    void bookings.refresh();
  }

  const slotOffering = offeringId ?? offerings.data?.[0]?.id;
  const nextSlots = useNextSlots((staff.data ?? []).map((s) => s.id), slotOffering);

  function openStaff(s: Schemas["StaffProfileOut"]) {
    router.push({ pathname: "/(customer)/staff/[id]", params: { id: String(s.id) } });
  }

  return (
    <HeroPage title="Inicio" onRefresh={refresh} hero={<HeroText kicker={`Hola, ${firstName}`} title="¿Quién limpia tu casa esta semana?" />}>
      <Rise>{bookings.loading ? <SkeletonCards count={1} /> : next ? <NextVisit booking={next} staffName={staffName.get(next.staff_id)} /> : <PlanVisit returning={!!bookings.data?.length} />}</Rise>

      <View className="gap-3">
        <SectionHeader title="Servicios" detail="Toca para ver horarios" />
        <StateView loading={offerings.loading} error={offerings.error} empty={!offerings.data?.length} emptyIcon="sparkle" emptyTitle="Aún no hay servicios disponibles" onRetry={offerings.refresh}>
          <HorizontalScroll className="-mx-4" contentContainerClassName="gap-3 px-4 pb-2 pt-1">
            {(offerings.data ?? []).map((o, i) => (
              <ServiceTile key={o.id} offering={o} index={i} selected={offeringId === o.id} onPress={() => setOfferingId(offeringId === o.id ? null : o.id)} />
            ))}
          </HorizontalScroll>
        </StateView>
      </View>

      <View className="gap-3">
        <SectionHeader title="Nuestro equipo" detail={staff.data?.length ? `${staff.data.length} personas` : undefined} />
        <StateView
          loading={staff.loading}
          error={staff.error}
          empty={!staff.data?.length}
          emptyIcon="people"
          emptyTitle="Por ahora no hay personal disponible"
          emptyText="Vuelve más tarde o desliza hacia abajo para actualizar."
          onRetry={staff.refresh}
        >
          <View className="gap-3">
            {(staff.data ?? []).map((s, i) => (
              <Rise key={s.id} index={i + 2}>
                <StaffCard staff={s} slot={nextSlots[s.id]} onPress={() => openStaff(s)} />
              </Rise>
            ))}
          </View>
        </StateView>
      </View>
    </HeroPage>
  );
}
