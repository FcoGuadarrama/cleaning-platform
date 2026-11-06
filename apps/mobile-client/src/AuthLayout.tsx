import { router } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./icons";
import { Text } from "./text";
import { color } from "./theme";
import { Wordmark } from "./ui";

/** White sign-in / sign-up page: wordmark (or back), large title, then the form. */
export function AuthLayout({ title, subtitle, back, children }: { title: string; subtitle: string; back?: boolean; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }}>
        <View className="flex-1 gap-8 px-6">
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Regresar"
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/login"))}
              className="-ml-3 h-12 w-12 items-center justify-center rounded-full active:bg-surface"
            >
              <Icon name="back" size={24} color={color.text} strokeWidth={1.8} />
            </Pressable>
          ) : (
            <View className="pt-8">
              <Wordmark />
            </View>
          )}
          <View className="gap-2">
            <Text accessibilityRole="header" className="text-2xl font-bold leading-[40px] tracking-[-1px] text-text">{title}</Text>
            <Text className="text-md text-text-muted">{subtitle}</Text>
          </View>
          <View className="gap-5">{children}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
