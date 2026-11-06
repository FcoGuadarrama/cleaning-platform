import { router, type Href } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./icons";
import { Text } from "./text";
import { color } from "./theme";

/** Root screen of a tab: white page, content starts under the status bar. */
export function Screen({ children, onRefresh, refreshing = false }: { children: ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.primary} /> : undefined}
    >
      <View className="gap-7 px-5">{children}</View>
    </ScrollView>
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
