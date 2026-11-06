import { cssInterop } from "nativewind";
import { useEffect, type ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// Reanimated components are not NativeWind-aware by default; map className → style.
cssInterop(AnimatedPressable, { className: "style" });
cssInterop(Animated.View, { className: "style" });

/** Press feedback on touch-down (not release), settling back with a critically damped spring. */
export function PressableScale({ children, style, scaleTo = 0.97, ...props }: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      style={[style, animated]}
      onPressIn={(e) => {
        if (!reduced) scale.value = withTiming(scaleTo, { duration: 110, easing: Easing.out(Easing.quad) });
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { duration: 350, dampingRatio: 1 });
        props.onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

/** One orchestrated entrance per screen: items rise in, staggered, only on first mount. */
export function Rise({ index = 0, children }: { index?: number; children: ReactNode }) {
  return <Animated.View entering={FadeInDown.duration(380).delay(Math.min(index, 6) * 55).easing(Easing.out(Easing.cubic))}>{children}</Animated.View>;
}

/** Loading placeholder that breathes; static when the person asked for reduced motion. */
export function Skeleton({ className = "", style }: { className?: string; style?: StyleProp<ViewStyle> }) {
  const opacity = useSharedValue(1);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!reduced) opacity.value = withRepeat(withTiming(0.45, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [opacity, reduced]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View className={`rounded-md bg-border/50 ${className}`} style={[style, animated]} />;
}
