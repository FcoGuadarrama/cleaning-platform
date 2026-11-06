import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Screen } from "./screen";
import { useSession } from "./session";
import { Text } from "./text";
import { Avatar, LargeTitle, Overline, TextLink } from "./ui";

/** "Tu cuenta": profile header, the role's sections, then sign out. */
export function AccountScreen({ children }: { children?: ReactNode }) {
  const { user, logout } = useSession();
  if (!user) return null;
  const firstName = user.full_name.split(/\s+/)[0] ?? user.full_name;
  return (
    <Screen>
      <View className="gap-5">
        <LargeTitle title="Tu cuenta" />
        <View className="flex-row items-center gap-5">
          <Avatar name={user.full_name} size="xl" />
          <View className="w-px self-stretch bg-border" />
          <View className="flex-1 gap-0.5">
            <Text className="text-xl font-semibold tracking-[-0.5px] text-text">{firstName}</Text>
            <Text numberOfLines={1} className="text-sm text-text-muted">{user.email}</Text>
            <TextLink label="Editar perfil" soon />
          </View>
        </View>
      </View>
      {children}
      <Pressable accessibilityRole="button" onPress={logout} className="min-h-11 justify-center self-start active:opacity-60">
        <Text className="border-b border-text pb-0.5 text-md text-text">Cerrar sesión</Text>
      </Pressable>
    </Screen>
  );
}

/** Uppercase group label over a list ("TU HOGAR"). */
export function AccountSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Overline>{title}</Overline>
      {children}
    </View>
  );
}
