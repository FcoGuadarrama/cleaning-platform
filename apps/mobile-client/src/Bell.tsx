import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Icon } from "./icons";
import { inboxRoute, useInbox } from "./inbox";
import { Text } from "./text";
import { color } from "./theme";

/** Header bell with the unread count; opens the inbox. */
export function Bell({ role }: { role: "customer" | "staff" }) {
  const { unread } = useInbox();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notificaciones, ${unread} sin leer` : "Notificaciones"}
      onPress={() => router.push(inboxRoute(role))}
      className="h-11 w-11 items-center justify-center rounded-full active:bg-surface"
    >
      <Icon name="bell" size={26} color={color.text} strokeWidth={1.6} />
      {unread ? (
        <View className="absolute right-0.5 top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1">
          <Text className="text-[11px] font-semibold leading-[14px] text-on-primary">{unread > 9 ? "9+" : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
