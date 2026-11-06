import { Platform, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT_FAMILIES } from "./font-families.cjs";
import { Icon, type IconName } from "./icons";
import { color } from "./theme";

export const stackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: color.background },
};

/** Flat white tab bar under a hairline; the active tab turns brand color (and solid where the glyph allows). */
export function useTabScreenOptions() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === "web" ? 10 : 8);
  return {
    headerShown: false,
    tabBarActiveTintColor: color.primary,
    tabBarInactiveTintColor: color.text,
    tabBarLabelStyle: { fontSize: 13, fontFamily: FONT_FAMILIES.medium, marginTop: 2 },
    tabBarStyle: {
      height: 68 + bottom,
      paddingTop: 8,
      paddingBottom: bottom,
      borderTopWidth: 1,
      borderTopColor: color.border,
      backgroundColor: color.background,
      elevation: 0,
    },
    sceneStyle: { backgroundColor: color.background },
  };
}

/** `solid` fills the glyph when focused (house, person); outline-only glyphs just change color. */
export const tabIcon =
  (name: IconName, solid = false) =>
  ({ color: tint, focused }: { color: ColorValue; focused: boolean }) => <Icon name={name} size={26} color={tint} strokeWidth={1.6} filled={solid && focused} />;
