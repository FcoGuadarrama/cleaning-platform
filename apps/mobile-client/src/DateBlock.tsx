import { Text, View } from "react-native";
import { dayParts } from "./format";

/** Calendar-leaf date: weekday over a large day number, for list rows. */
export function DateBlock({ iso }: { iso: string }) {
  const d = dayParts(iso);
  return (
    <View className="w-12 items-center rounded-md bg-surface py-1.5">
      <Text className="text-xs font-semibold capitalize text-primary">{d.weekday}</Text>
      <Text className="text-lg font-bold text-text">{d.day}</Text>
      <Text className="text-xs capitalize text-text-muted">{d.month}</Text>
    </View>
  );
}
