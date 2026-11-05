import { Platform, type ColorValue } from "react-native";
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

/** Floating, rounded tab bar that sits above the home indicator; the active tab gets a soft pill. */
export function useTabScreenOptions() {
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    tabBarActiveTintColor: color.primary,
    tabBarInactiveTintColor: color["text-muted"],
    tabBarActiveBackgroundColor: color["primary-soft"],
    tabBarLabelStyle: { fontSize: 11, fontWeight: "700" as const },
    tabBarItemStyle: { margin: 6, borderRadius: 18 },
    tabBarStyle: {
      position: "absolute" as const,
      marginHorizontal: 16,
      bottom: Math.max(insets.bottom, Platform.OS === "web" ? 16 : 12),
      height: 68,
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

export const tabIcon =
  (name: IconName) =>
  ({ color: tint }: { color: ColorValue }) => <Icon name={name} size={24} color={tint} strokeWidth={2} />;
