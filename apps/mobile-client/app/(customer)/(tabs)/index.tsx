import { router } from "expo-router";
import { api } from "../../../src/api";
import { Avatar, Group, Page, Row, StateView } from "../../../src/ui";
import { useResource } from "../../../src/useResource";

export default function StaffList() {
  const staff = useResource(() => api.GET("/staff"));
  return (
    <Page title="Elige quién limpia" subtitle="Toca a una persona del equipo para ver sus horarios libres." onRefresh={staff.refresh}>
      <StateView
        loading={staff.loading}
        error={staff.error}
        empty={!staff.data?.length}
        emptyIcon="people"
        emptyTitle="Por ahora no hay personal disponible"
        emptyText="Vuelve más tarde o desliza hacia abajo para actualizar."
        onRetry={staff.refresh}
      >
        <Group>
          {(staff.data ?? []).map((s) => (
            <Row
              key={s.id}
              title={s.display_name}
              subtitle={s.bio ?? undefined}
              detail="Aún sin reseñas"
              leading={<Avatar name={s.display_name} />}
              accessibilityLabel={`Ver horarios de ${s.display_name}`}
              onPress={() => router.push({ pathname: "/(customer)/book", params: { staffId: String(s.id), name: s.display_name } })}
            />
          ))}
        </Group>
      </StateView>
    </Page>
  );
}
