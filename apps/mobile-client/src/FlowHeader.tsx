import { router, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./icons";
import { alpha, color } from "./theme";
import { Bubbles } from "./ui";

/** Solid brand header for pushed screens: back control + content; the body overlaps its rounded edge. */
export function FlowHeader({ fallback, children, trailing }: { fallback: Href; children: ReactNode; trailing?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="overflow-hidden rounded-b-2xl bg-primary px-5 pb-14" style={{ paddingTop: insets.top + 12 }}>
      <Bubbles />
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Regresar"
          onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
          className="h-11 w-11 items-center justify-center rounded-full active:opacity-70"
          style={{ backgroundColor: alpha(color["on-primary"], 0.16) }}
        >
          <Icon name="back" size={22} color={color["on-primary"]} strokeWidth={2.4} />
        </Pressable>
        {trailing}
      </View>
      <View className="mt-4">{children}</View>
    </View>
  );
}
