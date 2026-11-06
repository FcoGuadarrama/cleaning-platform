import type { Schemas } from "@repo/api-client";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { HorizontalScroll } from "../../../src/HorizontalScroll";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../src/api";
import { useDaySlots } from "../../../src/availability";
import { FlowHeader } from "../../../src/FlowHeader";
import { businessDayInstant, dayParts, formatDuration, formatMoney, formatTime, nextBusinessDays } from "../../../src/format";
import { Icon, type IconName } from "../../../src/icons";
import { Rise, Skeleton } from "../../../src/motion";
import { color, shadow } from "../../../src/theme";
import { Avatar, Button, Card, IconTile, StateView, toneFor } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

const SERVICE_ICONS: IconName[] = ["home", "sparkle", "drop", "broom"];

function Fact({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View className="flex-1 items-center gap-2 rounded-lg bg-surface px-2 py-3">
      <Icon name={icon} size={20} color={color.primary} strokeWidth={2} />
      <Text className="text-center text-xs font-semibold text-text">{label}</Text>
    </View>
  );
}

function DayChip({ ymd, selected, onPress }: { ymd: string; selected: boolean; onPress: () => void }) {
  const d = dayParts(businessDayInstant(ymd));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-11 flex-row items-center gap-1.5 rounded-full px-4 ${selected ? "bg-primary" : "bg-surface"}`}
    >
      <Text className={`text-sm font-bold capitalize ${selected ? "text-on-primary" : "text-text"}`}>{d.weekday}</Text>
      <Text className={`text-sm ${selected ? "text-on-primary" : "text-text-muted"}`}>{d.day}</Text>
    </Pressable>
  );
}

export default function StaffProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const staffId = Number(id);
  const insets = useSafeAreaInsets();
  const staff = useResource(() => api.GET("/staff"));
  const offerings = useResource(() => api.GET("/offerings"));
  const days = nextBusinessDays(5);
  const [offering, setOffering] = useState<Schemas["OfferingOut"] | null>(null);
  const [day, setDay] = useState(days[0]!);
  const slots = useDaySlots(staffId, offering?.id, day);
  const person = staff.data?.find((s) => s.id === staffId);
  const name = person?.display_name ?? "";

  useEffect(() => {
    if (!offering && offerings.data?.[0]) setOffering(offerings.data[0]);
  }, [offerings.data, offering]);

  function book(slot?: string) {
    router.push({
      pathname: "/(customer)/book",
      params: { staffId: String(staffId), name, ...(offering ? { offeringId: String(offering.id) } : {}), ...(slot ? { day, slot } : {}) },
    });
  }

  return (
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="pb-8">
        <FlowHeader fallback="/(customer)/(tabs)">
          <View className="items-center gap-3">
            {person ? <Avatar name={name} tone={toneFor(staffId)} size="xl" ring /> : <Skeleton className="h-[88px] w-[88px] rounded-full" />}
            <View className="items-center gap-1">
              <Text accessibilityRole="header" className="text-2xl font-extrabold tracking-[-0.8px] text-on-primary">{name || " "}</Text>
              <View className="flex-row items-center gap-1.5">
                <Icon name="star" size={15} color={color.accent} filled strokeWidth={1.5} />
                <Text className="text-sm font-medium text-on-primary opacity-85">Aún sin reseñas</Text>
              </View>
            </View>
          </View>
        </FlowHeader>

        <View className="-mt-8 gap-4 px-4">
          <Rise>
            <Card className="gap-4">
              <View className="flex-row gap-2">
                <Fact icon="shield" label="Equipo de la empresa" />
                <Fact icon="calendar" label="Lunes a viernes" />
                <Fact icon="sparkle" label={`${offerings.data?.length ?? "–"} servicios`} />
              </View>
              {person?.bio ? (
                <View className="gap-1.5">
                  <Text className="text-md font-bold text-text">Sobre {name}</Text>
                  <Text className="text-md leading-[24px] text-text-muted">{person.bio}</Text>
                </View>
              ) : null}
            </Card>
          </Rise>

          <Rise index={1}>
            <Card className="gap-3">
              <Text accessibilityRole="header" className="text-lg font-bold text-text">Servicios</Text>
              <StateView loading={offerings.loading} error={offerings.error} empty={!offerings.data?.length} emptyIcon="sparkle" emptyTitle="Aún no hay servicios disponibles" onRetry={offerings.refresh}>
                <View className="gap-2">
                  {(offerings.data ?? []).map((o, i) => {
                    const on = offering?.id === o.id;
                    return (
                      <Pressable
                        key={o.id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        onPress={() => setOffering(o)}
                        className={`flex-row items-center gap-3 rounded-lg border-2 p-3 ${on ? "border-primary bg-primary-soft" : "border-border/60"}`}
                      >
                        <IconTile icon={SERVICE_ICONS[i % SERVICE_ICONS.length]!} tone={toneFor(i)} size={44} />
                        <View className="flex-1">
                          <Text className="text-md font-bold text-text">{o.name}</Text>
                          <Text className="text-sm text-text-muted">{formatDuration(o.duration_minutes)}</Text>
                        </View>
                        <Text className="text-md font-extrabold text-text">{formatMoney(o.price_minor, o.currency)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </StateView>
            </Card>
          </Rise>

          <Rise index={2}>
            <Card className="gap-4">
              <View className="flex-row items-baseline justify-between">
                <Text accessibilityRole="header" className="text-lg font-bold text-text">Horarios libres</Text>
                {offering ? <Text className="text-sm text-text-muted">{offering.name}</Text> : null}
              </View>
              <HorizontalScroll className="-mx-4" contentContainerClassName="gap-2 px-4">
                {days.map((d) => <DayChip key={d} ymd={d} selected={d === day} onPress={() => setDay(d)} />)}
              </HorizontalScroll>
              {slots === null ? (
                <View className="flex-row gap-2">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 flex-1 rounded-full" />)}
                </View>
              ) : slots.length ? (
                <View className="flex-row flex-wrap gap-2">
                  {slots.slice(0, 6).map((s) => (
                    <Pressable
                      key={s.starts_at}
                      accessibilityRole="button"
                      accessibilityLabel={`Reservar a las ${formatTime(s.starts_at)}`}
                      onPress={() => book(s.starts_at)}
                      className="min-h-12 w-[31%] items-center justify-center rounded-full bg-primary-soft active:opacity-80"
                    >
                      <Text className="text-sm font-bold text-primary">{formatTime(s.starts_at)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text className="text-sm text-text-muted">Sin horarios libres este día. Prueba con otro.</Text>
              )}
              {slots && slots.length > 6 ? <Text className="text-sm text-text-muted">y {slots.length - 6} horarios más este día</Text> : null}
            </Card>
          </Rise>
        </View>
      </ScrollView>

      <View className="rounded-t-2xl bg-surface-raised px-5 pt-4" style={[{ paddingBottom: Math.max(insets.bottom, 16) }, shadow("3")]}>
        <Button label={name ? `Reservar con ${name}` : "Reservar"} onPress={() => book()} disabled={!person} />
      </View>
    </View>
  );
}
