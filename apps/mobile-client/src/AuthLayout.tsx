import { router } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./icons";
import { alpha, color, shadow } from "./theme";
import { Bubbles } from "./ui";

/** Placeholder mark until the brand logo exists (brand.json `assets.logo`). */
function BrandMark() {
  return (
    <View className="h-16 w-16 items-center justify-center rounded-xl bg-surface-raised" style={shadow("2")}>
      <Icon name="home" size={32} color={color.primary} strokeWidth={2.2} />
    </View>
  );
}

/** Brand-colored top with the form on a raised sheet, shared by login and signup. */
export function AuthLayout({ title, subtitle, back, children }: { title: string; subtitle: string; back?: boolean; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-primary">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="flex-grow">
        <View className="overflow-hidden px-6 pb-16" style={{ paddingTop: insets.top + (back ? 12 : 56) }}>
          <Bubbles />
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Regresar"
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/login"))}
              className="mb-6 h-11 w-11 items-center justify-center rounded-full active:opacity-70"
              style={{ backgroundColor: alpha(color["on-primary"], 0.16) }}
            >
              <Icon name="back" size={22} color={color["on-primary"]} strokeWidth={2.4} />
            </Pressable>
          ) : (
            <View className="mb-6">
              <BrandMark />
            </View>
          )}
          <Text accessibilityRole="header" className="text-2xl font-extrabold tracking-[-0.8px] text-on-primary">{title}</Text>
          <Text className="mt-2 text-md text-on-primary opacity-85">{subtitle}</Text>
        </View>
        <View className="-mt-8 flex-1 gap-5 rounded-t-2xl bg-surface px-6 pt-8" style={{ paddingBottom: insets.bottom + 32 }}>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
