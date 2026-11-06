import { Platform, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "./icons";
import { color, shadow } from "./theme";

export const stackScreenOptions = {
  headerBackButtonDisplayMode: "minimal" as const,
  headerShadowVisible: false,
  headerTintColor: color.primary,
  headerStyle: { backgroundColor: color.surface },
  headerTitleStyle: { color: color.text, fontWeight: "700" as const },
  contentStyle: { backgroundColor: color.surface },
};

/** Floating, rounded tab bar that sits above the home indicator; the active icon sits on a soft pill (see `tabIcon`). */
export function useTabScreenOptions() {
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    tabBarActiveTintColor: color.primary,
    tabBarInactiveTintColor: color["text-muted"],
    tabBarLabelStyle: { fontSize: 11, fontWeight: "700" as const, marginTop: 2 },
    tabBarItemStyle: { paddingVertical: 8 },
    tabBarStyle: {
      position: "absolute" as const,
      marginHorizontal: 16,
      bottom: Math.max(insets.bottom, Platform.OS === "web" ? 16 : 12),
      height: 72,
      paddingTop: 0,
      paddingBottom: 0,
      borderRadius: 26,
      borderTopWidth: 0,
      backgroundColor: color["surface-raised"],
      ...shadow("3"),
    },
    sceneStyle: { backgroundColor: color.surface },
  };
}

/** Active indicator drawn here (not via item background) so it stays a rounded pill on every platform. */
export const tabIcon =
  (name: IconName) =>
  ({ color: tint, focused }: { color: ColorValue; focused: boolean }) => (
    <View className={`h-8 w-16 items-center justify-center rounded-full ${focused ? "bg-primary-soft" : ""}`}>
      <Icon name={name} size={22} color={tint} strokeWidth={2} />
    </View>
  );
