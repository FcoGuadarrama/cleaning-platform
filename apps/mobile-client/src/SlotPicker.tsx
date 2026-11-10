import { Pressable, View } from "react-native";
import { businessDayInstant, dayParts, formatClock, formatLongDay } from "./format";
import { HorizontalScroll } from "./HorizontalScroll";
import { Skeleton } from "./motion";
import { Text } from "./text";

type Slot = { starts_at: string };

/** Scrollable business days, styled like the week strip on "Tus visitas". */
export function DayPicker({ days, selected, onSelect }: { days: string[]; selected: string; onSelect: (ymd: string) => void }) {
  return (
    <HorizontalScroll className="-mx-5" contentContainerClassName="gap-1.5 px-5" accessibilityLabel="Días disponibles">
      {days.map((d) => {
        const on = d === selected;
        const p = dayParts(businessDayInstant(d));
        const ink = on ? "text-on-primary" : "text-text";
        return (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={formatLongDay(businessDayInstant(d))}
            onPress={() => onSelect(d)}
            className={`h-[72px] w-[58px] items-center justify-center rounded-md active:opacity-80 ${on ? "bg-primary" : "bg-primary-soft"}`}
          >
            <Text className={`text-sm capitalize ${ink}`}>{p.weekday}</Text>
            <Text className={`text-xl font-medium leading-[28px] ${ink}`}>{p.day}</Text>
            <Text className={`text-xs capitalize ${ink}`}>{p.month}</Text>
          </Pressable>
        );
      })}
    </HorizontalScroll>
  );
}

/** Open times in rows of three; null while loading. `format` turns a slot's `starts_at` into its label. */
export function SlotGrid({
  slots,
  selected,
  onSelect,
  empty = "Sin horarios libres este día. Prueba con otro.",
  format = formatClock,
}: {
  slots: Slot[] | null;
  selected?: string | null;
  onSelect: (value: string) => void;
  empty?: string;
  format?: (value: string) => string;
}) {
  if (slots === null)
    return (
      <View className="flex-row gap-2">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 flex-1 rounded-md" />)}
      </View>
    );
  if (!slots.length) return <Text className="text-md text-text-muted">{empty}</Text>;
  const rows: Slot[][] = [];
  for (let i = 0; i < slots.length; i += 3) rows.push(slots.slice(i, i + 3));
  return (
    <View className="gap-2">
      {rows.map((row) => (
        <View key={row[0]!.starts_at} className="flex-row gap-2">
          {row.map((s) => {
            const on = s.starts_at === selected;
            return (
              <Pressable
                key={s.starts_at}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onSelect(s.starts_at)}
                className={`min-h-12 flex-1 items-center justify-center rounded-md border active:opacity-80 ${on ? "border-primary bg-primary" : "border-border bg-background"}`}
              >
                <Text className={`text-md font-medium ${on ? "text-on-primary" : "text-text"}`}>{format(s.starts_at)}</Text>
              </Pressable>
            );
          })}
          {Array.from({ length: 3 - row.length }, (_, i) => <View key={i} className="flex-1" />)}
        </View>
      ))}
    </View>
  );
}
