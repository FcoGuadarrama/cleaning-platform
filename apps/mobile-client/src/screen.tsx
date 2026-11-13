import { router, type Href } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell } from "./Bell";
import { Icon } from "./icons";
import { useSession } from "./session";
import { Text } from "./text";
import { color } from "./theme";
import { Wordmark } from "./ui";

/** Brand bar shared by every tab: wordmark and the inbox bell, with a hairline once content scrolls beneath it. */
function AppHeader({ scrolled }: { scrolled: boolean }) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  return (
    <View
      className={`flex-row items-center justify-between border-b bg-background px-5 pb-2 ${scrolled ? "border-border" : "border-transparent"}`}
      style={{ paddingTop: insets.top + 12 }}
    >
      <Wordmark />
      {user?.role === "staff" || user?.role === "customer" ? <Bell role={user.role} /> : null}
    </View>
  );
}

/** Root screen of a tab: pinned brand bar over a white scrolling page. */
export function Screen({ children, onRefresh, refreshing = false }: { children: ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const past = e.nativeEvent.contentOffset.y > 4;
    if (past !== scrolled) setScrolled(past);
  }
  return (
    <View className="flex-1 bg-background">
      <AppHeader scrolled={scrolled} />
      <ScrollView
        className="flex-1"
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.primary} /> : undefined}
      >
        <View className="gap-7 px-5">{children}</View>
      </ScrollView>
    </View>
  );
}

/** Back chevron + screen title for pushed screens. */
export function TopBar({ title, fallback, onBack }: { title: string; fallback: Href; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-row items-center gap-1 bg-background px-2" style={{ paddingTop: insets.top + 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Regresar"
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace(fallback)))}
        className="h-12 w-12 items-center justify-center rounded-full active:bg-surface"
      >
        <Icon name="back" size={24} color={color.text} strokeWidth={1.8} />
      </Pressable>
      <Text accessibilityRole="header" numberOfLines={1} className="flex-1 text-lg font-semibold text-text">{title}</Text>
    </View>
  );
}

/** Pushed screen: top bar, scrolling body and an optional action pinned above the home indicator. */
export function FlowScreen(props: { title: string; fallback: Href; onBack?: () => void; children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background">
      <TopBar title={props.title} fallback={props.fallback} onBack={props.onBack} />
      <ScrollView keyboardShouldPersistTaps="handled" className="flex-1" contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}>
        <View className="gap-6 px-5">{props.children}</View>
      </ScrollView>
      {props.footer ? (
        <View className="gap-3 bg-background px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          {props.footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
