import type { Schemas } from "@repo/api-client";
import type { Href } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Linking, Switch, View } from "react-native";
import { api, errorMessage } from "./api";
import { pushPermission, registerForPush, type PushPermission } from "./push";
import { FlowScreen } from "./screen";
import { color } from "./theme";
import { Button, InfoNote, List, Notice, Overline, Row, SkeletonRows } from "./ui";
import { useResource } from "./useResource";

type Category = Schemas["NotificationCategory"];

const LABELS: Record<"customer" | "staff", Partial<Record<Category, { title: string; subtitle: string }>>> = {
  customer: {
    visits: { title: "Visitas", subtitle: "Confirmaciones, recordatorios y cambios" },
    billing: { title: "Pagos y suscripción", subtitle: "Cobros, renovaciones y transferencias" },
  },
  staff: {
    visits: { title: "Servicios", subtitle: "Servicios nuevos, recordatorios y cancelaciones" },
    payouts: { title: "Pagos semanales", subtitle: "Cuando se registra tu pago" },
  },
};

function PermissionNotice({ permission, onAsk }: { permission: PushPermission; onAsk: () => void }) {
  if (permission === "granted") return null;
  if (permission === "unsupported")
    return <Notice text="Las notificaciones push solo llegan a la app instalada en tu teléfono. Aquí puedes elegir cuáles recibir." />;
  if (permission === "undetermined") return <Button label="Activar notificaciones" icon="bell" onPress={onAsk} />;
  return (
    <View className="gap-3">
      <Notice tone="warning" text="Las notificaciones están desactivadas para esta app en tu teléfono." />
      <Button label="Abrir ajustes del teléfono" variant="outline" onPress={() => void Linking.openSettings()} />
    </View>
  );
}

/** Push on/off per category. The inbox keeps every notice either way. */
export function NotificationSettingsScreen({ role, fallback }: { role: "customer" | "staff"; fallback: Href }) {
  const preferences = useResource(() => api.GET("/notification-preferences"));
  const [saved, setSaved] = useState<Partial<Record<Category, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PushPermission>("unsupported");

  useEffect(() => {
    void pushPermission().then(setPermission);
    // Coming back from the phone's settings may have changed the permission.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void pushPermission().then(setPermission);
    });
    return () => sub.remove();
  }, []);

  async function toggle(category: Category, push_enabled: boolean) {
    setSaved((current) => ({ ...current, [category]: push_enabled }));
    const { error: failed } = await api.PUT("/notification-preferences/{category}", { params: { path: { category } }, body: { push_enabled } });
    if (failed === undefined) {
      setError(null);
      return;
    }
    setSaved((current) => ({ ...current, [category]: !push_enabled }));
    setError(errorMessage(failed));
  }

  return (
    <FlowScreen title="Notificaciones" fallback={fallback}>
      <PermissionNotice permission={permission} onAsk={() => void registerForPush().then(setPermission)} />
      {error ? <Notice tone="danger" text={error} /> : null}
      {preferences.error ? <Notice tone="danger" text={preferences.error} /> : null}
      {preferences.loading && !preferences.data ? <SkeletonRows count={2} /> : null}
      {preferences.data ? (
        <View className="gap-2">
          <Overline>Recibir en el teléfono</Overline>
          <List>
            {preferences.data.map(({ category, push_enabled }) => {
              const label = LABELS[role][category];
              if (!label) return null;
              const on = saved[category] ?? push_enabled;
              return (
                <Row
                  key={category}
                  title={label.title}
                  subtitle={label.subtitle}
                  trailing={
                    <Switch
                      accessibilityLabel={label.title}
                      value={on}
                      onValueChange={(value) => void toggle(category, value)}
                      trackColor={{ true: color.primary, false: color.border }}
                    />
                  }
                />
              );
            })}
          </List>
        </View>
      ) : null}
      <InfoNote text="Aunque apagues un tipo de aviso, lo seguirás viendo en Notificaciones dentro de la app." />
    </FlowScreen>
  );
}
