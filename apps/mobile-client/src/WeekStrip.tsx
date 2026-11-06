import { Pressable, View } from "react-native";
import { businessDayInstant, formatLongDay } from "./format";
import { Text } from "./text";

const LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

/** Monday–Sunday tiles; the selected day is solid brand, days with a visit carry a dot. */
export function WeekStrip({ days, selected, marked, onSelect }: { days: string[]; selected: string; marked: Set<string>; onSelect: (ymd: string) => void }) {
  return (
    <View className="flex-row gap-1.5">
      {days.map((d, i) => {
        const on = d === selected;
        const ink = on ? "text-on-primary" : "text-text";
        return (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${formatLongDay(businessDayInstant(d))}${marked.has(d) ? ", con visita" : ""}`}
            onPress={() => onSelect(d)}
            className={`h-[66px] flex-1 items-center justify-center rounded-md active:opacity-80 ${on ? "bg-primary" : "bg-primary-soft"}`}
          >
            <Text className={`text-sm ${ink}`}>{LETTERS[i]}</Text>
            <Text className={`text-xl font-medium leading-[28px] ${ink}`}>{Number(d.slice(8))}</Text>
            <View className={`h-1 w-1 rounded-full ${marked.has(d) ? (on ? "bg-on-primary" : "bg-primary") : ""}`} />
          </Pressable>
        );
      })}
    </View>
  );
}
