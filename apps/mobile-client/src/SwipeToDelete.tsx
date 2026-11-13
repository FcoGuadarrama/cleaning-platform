import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { PanResponder, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Icon } from "./icons";
import { Text } from "./text";
import { color } from "./theme";

/** Fraction of the row, or a quick flick, that commits the delete on release. */
const COMMIT_FRACTION = 0.4;
const FLICK_VELOCITY = 0.8;
/** On web the browser still clicks the row when a drag ends; a press this soon after a swipe is that click. */
const CLICK_AFTER_SWIPE_MS = 400;

const SwipeGuard = createContext<() => boolean>(() => false);

/** For the row inside: true while, or just after, the person swiped it, so its press should not fire. */
export const useWasSwiped = () => useContext(SwipeGuard);

/**
 * Swipe the row left to delete it: the danger panel shows underneath, and releasing past the threshold slides
 * the row out and calls `onDelete`. The row itself should offer the same delete as an accessibility action.
 * PanResponder only claims clearly horizontal drags, so vertical scrolling and taps keep working.
 */
export function SwipeToDelete({ children, onDelete, label }: { children: ReactNode; onDelete: () => void; label: string }) {
  const x = useSharedValue(0);
  const width = useRef(0);
  const reduced = useReducedMotion();
  const swipeEndedAt = useRef<number | null>(null);
  const wasSwiped = useCallback(() => swipeEndedAt.current !== null && Date.now() - swipeEndedAt.current < CLICK_AFTER_SWIPE_MS, []);
  const deleteRef = useRef(onDelete);
  useEffect(() => {
    deleteRef.current = onDelete;
  }, [onDelete]);

  const responder = useMemo(() => {
    // Plain JS function, handed to the UI thread's animation callback and run back on the JS thread.
    const commit = () => deleteRef.current();
    const settle = () => {
      x.value = withSpring(0, { duration: 350, dampingRatio: 1 });
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        swipeEndedAt.current = Number.POSITIVE_INFINITY;
      },
      onPanResponderTerminationRequest: () => false,
      // Dragging right past the resting point meets resistance instead of revealing anything.
      onPanResponderMove: (_, g) => {
        x.value = g.dx < 0 ? g.dx : g.dx / 4;
      },
      onPanResponderRelease: (_, g) => {
        swipeEndedAt.current = Date.now();
        const w = width.current;
        if (w && (g.dx < -w * COMMIT_FRACTION || g.vx < -FLICK_VELOCITY)) {
          x.value = withTiming(-w, { duration: reduced ? 0 : 180, easing: Easing.out(Easing.quad) }, (done) => {
            if (done) scheduleOnRN(commit);
          });
        } else settle();
      },
      onPanResponderTerminate: () => {
        swipeEndedAt.current = Date.now();
        settle();
      },
    });
  }, [x, reduced]);

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // The label fades in as the row moves, so a short accidental drag barely shows it.
  const panel = useAnimatedStyle(() => ({ opacity: Math.min(1, -x.value / 60) }));

  return (
    <View
      className="overflow-hidden"
      onLayout={(e) => {
        width.current = e.nativeEvent.layout.width;
      }}
    >
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        className="absolute inset-0 flex-row items-center justify-end gap-2 bg-danger px-5"
        style={panel}
      >
        <Icon name="trash" size={20} color={color["on-danger"]} strokeWidth={1.8} />
        <Text className="text-md font-semibold text-on-danger">{label}</Text>
      </Animated.View>
      <Animated.View className="bg-background" style={row} {...responder.panHandlers}>
        <SwipeGuard.Provider value={wasSwiped}>{children}</SwipeGuard.Provider>
      </Animated.View>
    </View>
  );
}
