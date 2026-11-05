import type { ColorValue } from "react-native";
import { Icon, type IconName } from "./icons";
import { color } from "./theme";

export const stackScreenOptions = {
  headerBackButtonDisplayMode: "minimal" as const,
  headerShadowVisible: false,
  headerTintColor: color.primary,
  headerStyle: { backgroundColor: color.surface },
  headerTitleStyle: { color: color.text, fontWeight: "600" as const },
  contentStyle: { backgroundColor: color.surface },
};

export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: color.primary,
  tabBarInactiveTintColor: color["text-muted"],
  tabBarLabelStyle: { fontSize: 11, fontWeight: "600" as const },
  tabBarStyle: { backgroundColor: color["surface-raised"], borderTopColor: color.border },
  sceneStyle: { backgroundColor: color.surface },
};

export const tabIcon =
  (name: IconName) =>
  ({ color: tint }: { color: ColorValue }) => <Icon name={name} size={26} color={tint} />;
