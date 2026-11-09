import { useEffect, useRef, type ComponentProps, type ComponentRef } from "react";
import { Platform, ScrollView } from "react-native";

type WebScrollable = { getScrollableNode?: () => HTMLElement | null };

/**
 * Horizontal row that also scrolls with a vertical mouse wheel on web (desktop mice have no horizontal wheel).
 * At either end the wheel falls through to the page, so vertical scrolling is never trapped.
 */
export function HorizontalScroll(props: Omit<ComponentProps<typeof ScrollView>, "horizontal">) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    // react-native-web exposes the DOM node behind the ScrollView instance.
    const node = (ref.current as WebScrollable | null)?.getScrollableNode?.();
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const max = node.scrollWidth - node.clientWidth;
      const atStart = node.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = node.scrollLeft >= max - 1 && e.deltaY > 0;
      if (max <= 0 || atStart || atEnd) return;
      e.preventDefault();
      node.scrollLeft += e.deltaY;
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  return <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} {...props} />;
}
