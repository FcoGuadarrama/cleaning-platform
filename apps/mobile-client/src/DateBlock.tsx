import { Text, View } from "react-native";
import { dayParts } from "./format";

/** Calendar-leaf date: weekday over a large day number. */
export function DateBlock({ iso, size = "md" }: { iso: string; size?: "md" | "lg" }) {
  const d = dayParts(iso);
  const lg = size === "lg";
  return (
    <View className={`items-center rounded-lg bg-primary-soft ${lg ? "w-16 py-2" : "w-14 py-1.5"}`}>
      <Text className="text-xs font-bold capitalize text-primary">{d.weekday}</Text>
      <Text className={`${lg ? "text-xl" : "text-lg"} font-extrabold text-primary`}>{d.day}</Text>
      <Text className="text-xs font-medium capitalize text-primary">{d.month}</Text>
    </View>
  );
}
