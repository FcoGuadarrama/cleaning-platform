import { Link, router } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { api } from "../../src/api";
import { useSession } from "../../src/session";
import { Card, StateView } from "../../src/ui";
import { useResource } from "../../src/useResource";

export default function StaffList() {
  const staff = useResource(() => api.GET("/staff"));
  const { logout } = useSession();
  return (
    <View className="flex-1 bg-background">
      <StateView loading={staff.loading} error={staff.error} empty={!staff.data?.length} emptyText="Por ahora no hay personal disponible." onRetry={staff.refresh}>
        <FlatList
          data={staff.data ?? []}
          keyExtractor={(s) => String(s.id)}
          contentContainerClassName="gap-3 p-4"
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={`Ver disponibilidad de ${item.display_name}`} onPress={() => router.push({ pathname: "/(customer)/book", params: { staffId: String(item.id), name: item.display_name } })}>
              <Card>
                <Text className="text-lg font-semibold text-text">{item.display_name}</Text>
                {item.bio ? <Text className="text-md text-text-muted">{item.bio}</Text> : null}
                <Text className="text-sm text-text-muted">Aún sin reseñas</Text>
              </Card>
            </Pressable>
          )}
        />
      </StateView>
      <View className="flex-row justify-between p-4">
        <Link href="/(customer)/bookings" className="py-3 text-md text-primary">Mis reservas</Link>
        <Pressable accessibilityRole="button" onPress={logout} className="min-h-11 justify-center"><Text className="text-md text-text-muted">Cerrar sesión</Text></Pressable>
      </View>
    </View>
  );
}
