import type { Tabs } from "expo-router";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT_FAMILIES } from "./font-families.cjs";
import { Icon, type IconName } from "./icons";
import { alpha, color } from "./theme";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

/** Glyph per route name; routes without one render label-only. */
export type TabIcons = Record<string, IconName>;

const BAR_HEIGHT = 64;
const INSET = 4;
const GUTTER = 20;
const RADIUS = BAR_HEIGHT / 2;

/** Distance from the screen bottom to the bar: hugs the home indicator on notched phones, floats 12pt elsewhere. */
function barBottom(safeBottom: number) {
  return Math.max(safeBottom - 12, 12);
}

/** Space a tab's scroll content needs so its last row clears the floating bar. */
export function useTabBarInset() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + barBottom(insets.bottom) + 16;
}

const LIQUID_GLASS = Platform.OS === "ios" && isLiquidGlassAvailable();

/** Translucent layer behind the bar: system Liquid Glass on iOS 26+, frosted CSS blur on web, near-solid elsewhere. */
function Material({ children }: { children: ReactNode }) {
  if (LIQUID_GLASS) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive style={styles.material}>
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.material, Platform.OS === "web" ? WEB_GLASS : styles.solid]}>{children}</View>;
}

const WEB_GLASS: ViewStyle = {
  backgroundColor: alpha(color.background, 0.72),
  borderColor: alpha(color.border, 0.7),
  borderWidth: StyleSheet.hairlineWidth,
  backdropFilter: "blur(24px) saturate(180%)",
};

/**
 * Floating capsule tab bar. Every glyph stays outlined; the active tab is marked by tint, a heavier stroke and a
 * lens that slides between tabs with a critically damped spring (interruptible: it re-targets from where it is).
 */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab, insets, icons }: TabBarProps & { icons: TabIcons }) {
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  const itemWidth = width ? (width - INSET * 2) / state.routes.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    if (!itemWidth) return;
    const target = state.index * itemWidth;
    x.value = reduced ? target : withSpring(target, { duration: 380, dampingRatio: 1 });
  }, [itemWidth, reduced, state.index, x]);

  const lens = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: barBottom(insets.bottom) }]}>
      <View style={[styles.bar, !LIQUID_GLASS && styles.shadow]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Material>
          {itemWidth ? <Animated.View style={[styles.lens, { width: itemWidth }, lens]} /> : null}
          <View style={styles.row}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const focused = state.index === index;
              const label = typeof options.title === "string" ? options.title : route.name;
              const tint = focused ? color.primary : color.text;
              return (
                <TabItem
                  key={route.key}
                  label={label}
                  icon={icons[route.name]}
                  tint={tint}
                  focused={focused}
                  onPress={() => {
                    const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                    if (!focused && !event.defaultPrevented) navigateToTab(route.key);
                  }}
                  onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
                />
              );
            })}
          </View>
        </Material>
      </View>
    </View>
  );
}

function TabItem(props: { label: string; icon?: IconName; tint: string; focused: boolean; onPress: () => void; onLongPress: () => void }) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.focused }}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      onPressIn={() => {
        if (!reduced) scale.value = withTiming(0.9, { duration: 110, easing: Easing.out(Easing.quad) });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { duration: 350, dampingRatio: 1 });
      }}
      style={styles.item}
    >
      <Animated.View style={[styles.itemInner, pressed]}>
        {props.icon ? <Icon name={props.icon} size={24} color={props.tint} strokeWidth={props.focused ? 2 : 1.6} /> : null}
        <Text numberOfLines={1} style={[styles.label, { color: props.tint }]}>
          {props.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: GUTTER },
  bar: { width: "100%", maxWidth: 440, height: BAR_HEIGHT },
  material: { flex: 1, borderRadius: RADIUS, overflow: "hidden" },
  solid: { backgroundColor: alpha(color.background, 0.96), borderColor: color.border, borderWidth: StyleSheet.hairlineWidth },
  shadow: {
    shadowColor: "#0B1F24",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    borderRadius: RADIUS,
  },
  lens: {
    position: "absolute",
    top: INSET,
    bottom: INSET,
    left: INSET,
    borderRadius: RADIUS - INSET,
    backgroundColor: alpha(color.primary, 0.1),
  },
  row: { flex: 1, flexDirection: "row", paddingHorizontal: INSET },
  item: { flex: 1 },
  itemInner: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { fontSize: 11.5, fontFamily: FONT_FAMILIES.medium, letterSpacing: 0.1 },
});
