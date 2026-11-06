import { Pressable, Text, View } from "react-native";
import { Icon, type IconName } from "./icons";
import { useSession } from "./session";
import { color } from "./theme";
import { Avatar, Group, HeroPage, IconTile } from "./ui";

const ROLE_LABELS = { customer: "Cliente", staff: "Personal de limpieza", admin: "Administración" } as const;

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View className="min-h-[64px] flex-row items-center gap-4 px-4 py-3">
      <IconTile icon={icon} size={40} />
      <View className="flex-1">
        <Text className="text-xs font-semibold text-text-muted">{label}</Text>
        <Text className="text-md font-medium text-text">{value}</Text>
      </View>
    </View>
  );
}

export function AccountScreen() {
  const { user, logout } = useSession();
  if (!user) return null;
  return (
    <HeroPage
      title="Cuenta"
      hero={
        <View className="items-center gap-3 pt-2">
          <Avatar name={user.full_name} size="xl" ring />
          <View className="items-center gap-0.5">
            <Text accessibilityRole="header" className="text-xl font-extrabold tracking-[-0.4px] text-on-primary">{user.full_name}</Text>
            <Text className="text-md text-on-primary opacity-80">{ROLE_LABELS[user.role]}</Text>
          </View>
        </View>
      }
    >
      <Group>
        <InfoRow icon="mail" label="Correo electrónico" value={user.email} />
      </Group>
      <Group>
        <Pressable accessibilityRole="button" onPress={logout} className="min-h-[60px] flex-row items-center gap-4 px-4 active:bg-surface">
          <View className="h-10 w-10 items-center justify-center rounded-lg bg-danger-soft">
            <Icon name="logout" size={20} color={color.danger} strokeWidth={2} />
          </View>
          <Text className="text-md font-bold text-danger">Cerrar sesión</Text>
        </Pressable>
      </Group>
    </HeroPage>
  );
}
