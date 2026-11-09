import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { api } from "../../../src/api";
import { useDaySlots } from "../../../src/availability";
import { formatDuration, formatMoney, nextBusinessDays } from "../../../src/format";
import { Icon } from "../../../src/icons";
import { Skeleton } from "../../../src/motion";
import { FlowScreen } from "../../../src/screen";
import { DayPicker, SlotGrid } from "../../../src/SlotPicker";
import { Text } from "../../../src/text";
import { color } from "../../../src/theme";
import { Avatar, Button, List, Row, SectionTitle, SkeletonRows, StateView } from "../../../src/ui";
import { useResource } from "../../../src/useResource";
import { serviceIcon } from "../../../src/visits";

export default function StaffProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const staffId = Number(id);
  const staff = useResource(() => api.GET("/staff"));
  const offerings = useResource(() => api.GET("/offerings"));
  const days = nextBusinessDays(10);
  const [offeringId, setOfferingId] = useState<number | null>(null);
  const [day, setDay] = useState(days[0]!);
  const slots = useDaySlots(staffId, offeringId ?? undefined, day);
  const person = staff.data?.find((s) => s.id === staffId);
  const name = person?.display_name ?? "";

  useEffect(() => {
    if (!offeringId && offerings.data?.[0]) setOfferingId(offerings.data[0].id);
  }, [offerings.data, offeringId]);

  function book(slot?: string) {
    router.push({
      pathname: "/(customer)/book",
      params: { staffId: String(staffId), ...(offeringId ? { offeringId: String(offeringId) } : {}), ...(slot ? { day, slot } : {}) },
    });
  }

  return (
    <FlowScreen title="Profesional" fallback="/(customer)/(tabs)" footer={<Button label={name ? `Reservar con ${name}` : "Reservar"} onPress={() => book()} disabled={!person} />}>
      <View className="flex-row items-center gap-5">
        {person ? <Avatar name={name} size="xl" /> : <Skeleton className="h-[92px] w-[92px] rounded-full" />}
        <View className="w-px self-stretch bg-border" />
        <View className="flex-1 gap-1">
          <Text accessibilityRole="header" className="text-xl font-semibold tracking-[-0.5px] text-text">{name || " "}</Text>
          <Text className="text-sm text-text">Equipo de la empresa · Lunes a viernes</Text>
        </View>
      </View>
      {person?.bio ? <Text className="text-md leading-[24px] text-text">{person.bio}</Text> : null}

      <View className="gap-1">
        <SectionTitle title="Servicios" />
        <StateView loading={offerings.loading} error={offerings.error} empty={!offerings.data?.length} emptyIcon="broom" emptyTitle="Aún no hay servicios disponibles" onRetry={offerings.refresh} skeleton={<SkeletonRows />}>
          <List>
            {(offerings.data ?? []).map((o, i) => (
              <Row
                key={o.id}
                icon={serviceIcon(i)}
                title={o.name}
                subtitle={`${formatDuration(o.duration_minutes)} · ${formatMoney(o.price_minor, o.currency)}`}
                onPress={() => setOfferingId(o.id)}
                trailing={<Icon name={o.id === offeringId ? "check" : "circle"} size={22} color={o.id === offeringId ? color.primary : color.border} strokeWidth={2} />}
                accessibilityLabel={`${o.name}${o.id === offeringId ? ", elegido" : ""}`}
              />
            ))}
          </List>
        </StateView>
      </View>

      <View className="gap-4">
        <SectionTitle title="Horarios libres" />
        <DayPicker days={days} selected={day} onSelect={setDay} />
        <SlotGrid slots={offeringId ? slots : null} onSelect={(s) => book(s)} />
      </View>
    </FlowScreen>
  );
}
