import { View } from "react-native";
import { dayParts } from "./format";
import { Text } from "./text";

/** Calendar leaf on the soft brand surface: weekday, day number, month. */
export function DateBlock({ iso, size = "md" }: { iso: string; size?: "sm" | "md" }) {
  const d = dayParts(iso);
  const sm = size === "sm";
  return (
    <View className={`items-center justify-center rounded-md bg-primary-soft ${sm ? "w-[60px] py-1.5" : "w-[78px] py-2.5"}`}>
      <Text className="text-xs font-semibold uppercase text-text">{d.weekday}</Text>
      <Text className={`${sm ? "text-xl" : "text-2xl"} font-semibold leading-[34px] text-text`}>{d.day}</Text>
      {sm ? null : <Text className="text-xs font-semibold uppercase text-text">{d.month}</Text>}
    </View>
  );
}
