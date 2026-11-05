import type { Schemas } from "@repo/api-client";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { api } from "../../../src/api";
import { DateBlock } from "../../../src/DateBlock";
import { BOOKING_LABELS, BOOKING_TONES, formatDuration, formatMoney, formatTime } from "../../../src/format";
import { Icon, type IconName } from "../../../src/icons";
import { useSession } from "../../../src/session";
import { color, shadow } from "../../../src/theme";
import { Avatar, Badge, Card, HeroPage, HeroText, IconTile, SectionHeader, StateView, toneFor } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

const SERVICE_ICONS: IconName[] = ["home", "sparkle", "drop", "broom"];
const ACTIVE = new Set(["held", "confirmed", "in_progress"]);

function NextVisit({ booking, staffName }: { booking: Schemas["BookingOut"]; staffName?: string }) {
  return (
    <Card onPress={() => router.push("/(customer)/(tabs)/bookings")} accessibilityLabel="Ver tu próxima visita">
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

function FirstVisit() {
  return (
    <Card>
      <View className="flex-row items-center gap-4">
        <IconTile icon="sparkle" tone="accent" size={56} />
        <View className="flex-1 gap-1">
          <Text className="text-lg font-bold text-text">Agenda tu primera limpieza</Text>
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

function StaffCard({ staff, onPress }: { staff: Schemas["StaffProfileOut"]; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`Ver horarios de ${staff.display_name}`}>
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
      <View className="mt-4 flex-row items-center justify-between rounded-full bg-primary-soft px-4 py-2.5">
        <Text className="text-sm font-bold text-primary">Ver horarios</Text>
        <Icon name="chevron" size={18} color={color.primary} strokeWidth={2.4} />
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

  function openStaff(s: Schemas["StaffProfileOut"]) {
    router.push({
      pathname: "/(customer)/book",
      params: { staffId: String(s.id), name: s.display_name, ...(offeringId ? { offeringId: String(offeringId) } : {}) },
    });
  }

  return (
    <HeroPage onRefresh={refresh} hero={<HeroText kicker={`Hola, ${firstName}`} title="¿Quién limpia tu casa esta semana?" />}>
      {bookings.loading ? <Card><Text className="text-sm text-text-muted">Buscando tus visitas…</Text></Card> : next ? <NextVisit booking={next} staffName={staffName.get(next.staff_id)} /> : <FirstVisit />}

      <View className="gap-3">
        <SectionHeader title="Servicios" detail="Elige uno" />
        <StateView loading={offerings.loading} error={offerings.error} empty={!offerings.data?.length} emptyIcon="sparkle" emptyTitle="Aún no hay servicios disponibles" onRetry={offerings.refresh}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-3 px-4 pb-2 pt-1">
            {(offerings.data ?? []).map((o, i) => (
              <ServiceTile key={o.id} offering={o} index={i} selected={offeringId === o.id} onPress={() => setOfferingId(offeringId === o.id ? null : o.id)} />
            ))}
          </ScrollView>
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
            {(staff.data ?? []).map((s) => <StaffCard key={s.id} staff={s} onPress={() => openStaff(s)} />)}
          </View>
        </StateView>
      </View>
    </HeroPage>
  );
}
