import type { Schemas } from "@repo/api-client";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { shortAddress, useAddresses } from "../../../src/addresses";
import { api } from "../../../src/api";
import { DateBlock } from "../../../src/DateBlock";
import { BOOKING_LABELS, BOOKING_TONES, formatDuration, formatMoney, formatClock, formatRelativeDay, formatWeekday } from "../../../src/format";
import { Icon } from "../../../src/icons";
import { HomeScene } from "../../../src/illustrations";
import { Rise } from "../../../src/motion";
import { Screen } from "../../../src/screen";
import { serviceIcon, UPCOMING } from "../../../src/visits";
import { Text } from "../../../src/text";
import { color } from "../../../src/theme";
import { Avatar, Button, Card, Hairline, List, Row, SectionTitle, SkeletonCard, SkeletonRows, StateView, StatusLine, TextLink, Wordmark } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

type Booking = Schemas["BookingOut"];

function NextVisit({ booking, offering, staffName }: { booking: Booking; offering?: Schemas["OfferingOut"]; staffName?: string }) {
  return (
    <Card className="gap-4">
      <View className="flex-row items-center gap-4">
        <DateBlock iso={booking.starts_at} />
        <View className="flex-1 gap-1">
          <Text className="text-lg font-semibold text-text">
            {formatRelativeDay(booking.starts_at)}, {formatClock(booking.starts_at)}
          </Text>
          {offering ? <Text className="text-sm text-text">{offering.name} · {formatDuration(offering.duration_minutes)}</Text> : null}
          <StatusLine label={BOOKING_LABELS[booking.status]} tone={BOOKING_TONES[booking.status]} />
        </View>
      </View>
      <Hairline />
      <View className="flex-row items-center gap-4">
        <Avatar name={staffName ?? "?"} size="md" />
        <View className="flex-1">
          <Text className="text-md font-semibold text-text">{staffName ?? "Personal asignado"}</Text>
          <Text className="text-sm text-text-muted">Tu profesional</Text>
        </View>
      </View>
      <Button label="Ver mi visita" onPress={() => router.push({ pathname: "/(customer)/booking/[id]", params: { id: String(booking.id) } })} />
    </Card>
  );
}

function FirstVisit({ returning }: { returning: boolean }) {
  return (
    <Card className="gap-1">
      <Text className="text-lg font-semibold text-text">{returning ? "No tienes visitas próximas" : "Aún no tienes visitas"}</Text>
      <Text className="text-sm text-text-muted">Elige un servicio aquí abajo y reserva con la persona que prefieras.</Text>
    </Card>
  );
}

export default function Home() {
  const bookings = useResource(() => api.GET("/bookings"));
  const offerings = useResource(() => api.GET("/offerings"));
  const staff = useResource(() => api.GET("/staff"));
  const addresses = useAddresses();
  const home = addresses.data?.find((a) => a.is_default);

  const sorted = [...(bookings.data ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const next = sorted.find((b) => UPCOMING.has(b.status));
  const offeringOf = (id: number) => offerings.data?.find((o) => o.id === id);
  const staffName = (id: number) => staff.data?.find((s) => s.id === id)?.display_name;

  function refresh() {
    void bookings.refresh();
    void offerings.refresh();
    void staff.refresh();
    void addresses.refresh();
  }

  return (
    <Screen onRefresh={refresh}>
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Wordmark />
          <View accessibilityLabel="Notificaciones, próximamente" className="h-11 w-11 items-center justify-center opacity-40">
            <Icon name="bell" size={26} color={color.text} strokeWidth={1.6} />
          </View>
        </View>
        {addresses.data ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={home ? `Domicilio principal: ${home.label}. Mis domicilios` : "Agrega tu domicilio"}
            onPress={() => router.push("/(customer)/addresses")}
            className="min-h-11 flex-row items-center gap-1.5 self-start active:opacity-60"
          >
            <Icon name="pin" size={18} color={color.text} strokeWidth={1.6} />
            <Text numberOfLines={1} className="shrink text-sm text-text">
              {home ? <Text className="font-semibold">{home.label} · </Text> : null}
              {home ? shortAddress(home) : "Agrega tu domicilio"}
            </Text>
            <Icon name="chevron" size={16} color={color.text} strokeWidth={1.8} />
          </Pressable>
        ) : null}
        <Text accessibilityRole="header" className="pt-3 text-2xl font-bold leading-[38px] tracking-[-1px] text-text">
          Tu {formatWeekday(new Date().toISOString())},{"\n"}con más tiempo.
        </Text>
      </View>

      <View className="-mx-1 h-[150px] overflow-hidden rounded-lg">
        <HomeScene />
      </View>

      <View className="gap-3">
        <SectionTitle title="Tu próxima visita" />
        <Rise>
          {bookings.loading ? (
            <SkeletonCard />
          ) : next ? (
            <NextVisit booking={next} offering={offeringOf(next.offering_id)} staffName={staffName(next.staff_id)} />
          ) : (
            <FirstVisit returning={sorted.length > 0} />
          )}
        </Rise>
      </View>

      <View className="gap-1">
        <SectionTitle title="¿Qué necesita tu casa?" />
        <StateView
          loading={offerings.loading}
          error={offerings.error}
          empty={!offerings.data?.length}
          emptyIcon="broom"
          emptyTitle="Aún no hay servicios disponibles"
          onRetry={offerings.refresh}
          skeleton={<SkeletonRows count={2} />}
        >
          <List>
            {(offerings.data ?? []).map((o, i) => (
              <Row
                key={o.id}
                icon={serviceIcon(i)}
                title={o.name}
                subtitle={`${formatDuration(o.duration_minutes)} · ${formatMoney(o.price_minor, o.currency)}`}
                accessibilityLabel={`Reservar ${o.name}`}
                onPress={() => router.push({ pathname: "/(customer)/book", params: { offeringId: String(o.id) } })}
              />
            ))}
          </List>
        </StateView>
        <TextLink label="Conoce los planes mensuales" onPress={() => router.push("/(customer)/plans")} />
      </View>
    </Screen>
  );
}
