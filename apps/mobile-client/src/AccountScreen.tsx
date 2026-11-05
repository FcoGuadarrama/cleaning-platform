import { Pressable, Text, View } from "react-native";
import { Icon } from "./icons";
import { useSession } from "./session";
import { color } from "./theme";
import { Avatar, Group, Page, Section } from "./ui";

const ROLE_LABELS = { customer: "Cliente", staff: "Personal de limpieza", admin: "Administración" } as const;

export function AccountScreen() {
  const { user, logout } = useSession();
  if (!user) return null;
  return (
    <Page title="Cuenta">
      <View className="flex-row items-center gap-4 rounded-lg bg-surface-raised p-4">
        <Avatar name={user.full_name} size="lg" />
        <View className="flex-1 gap-0.5">
          <Text className="text-lg font-semibold text-text">{user.full_name}</Text>
          <Text className="text-sm text-text-muted">{user.email}</Text>
          <Text className="text-xs text-text-muted">{ROLE_LABELS[user.role]}</Text>
        </View>
      </View>
      <Section>
        <Group>
          <Pressable accessibilityRole="button" onPress={logout} className="min-h-[52px] flex-row items-center gap-3 px-4 active:bg-surface">
            <Icon name="logout" size={22} color={color.danger} />
            <Text className="text-md font-medium text-danger">Cerrar sesión</Text>
          </Pressable>
        </Group>
      </Section>
    </Page>
  );
}
