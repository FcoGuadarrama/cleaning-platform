import type { Schemas } from "@repo/api-client";
import { router, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { api, errorMessage } from "./api";
import { formatClock, formatRelativeDay } from "./format";
import { notificationTarget, useInbox } from "./inbox";
import { FlowScreen } from "./screen";
import { Text } from "./text";
import { Button, EmptyState, List, Notice, SkeletonRows } from "./ui";

type Item = Schemas["NotificationOut"];
const PAGE = 30;

/** "Hoy, 14:30" or "jue 12 nov, 09:15". */
const when = (iso: string) => `${formatRelativeDay(iso)}, ${formatClock(iso)}`;

function NotificationRow({ item, onPress }: { item: Item; onPress: () => void }) {
  const unread = item.read_at === null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? "Sin leer. " : ""}${item.title}. ${item.body}`}
      onPress={onPress}
      className="flex-row items-start gap-3 py-4 active:opacity-60"
    >
      <View className={`mt-2 h-2.5 w-2.5 rounded-full ${unread ? "bg-primary" : "bg-transparent"}`} />
      <View className="flex-1 gap-1">
        <Text className={`text-md text-text ${unread ? "font-semibold" : ""}`}>{item.title}</Text>
        <Text className="text-sm text-text-muted">{item.body}</Text>
        <Text className="text-xs text-text-muted">{when(item.created_at)}</Text>
      </View>
    </Pressable>
  );
}

/** The signed-in user's notices, newest first. Opening one marks it read and goes to what it is about. */
export function InboxScreen({ role, fallback }: { role: "customer" | "staff"; fallback: Href }) {
  const inbox = useInbox();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (beforeId?: number) => {
    const { data, error: failed } = await api.GET("/notifications", { params: { query: { limit: PAGE, before_id: beforeId } } });
    if (!data) {
      setError(errorMessage(failed));
      return;
    }
    setError(null);
    setItems((current) => (beforeId && current ? [...current, ...data] : data));
    setHasMore(data.length === PAGE);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    const last = items?.at(-1);
    if (!last) return;
    setLoadingMore(true);
    await load(last.id);
    setLoadingMore(false);
  }

  async function open(item: Item) {
    if (item.read_at === null) {
      const { data } = await api.POST("/notifications/{notification_id}/read", { params: { path: { notification_id: item.id } } });
      if (data) setItems((current) => current?.map((n) => (n.id === data.id ? data : n)) ?? null);
      void inbox.refresh();
    }
    const target = notificationTarget(role, item.data);
    if (target) router.push(target);
  }

  async function readAll() {
    const { error: failed } = await api.POST("/notifications/read-all");
    if (failed !== undefined) {
      setError(errorMessage(failed));
      return;
    }
    const now = new Date().toISOString();
    setItems((current) => current?.map((n) => (n.read_at ? n : { ...n, read_at: now })) ?? null);
    void inbox.refresh();
  }

  const unread = items?.some((n) => n.read_at === null) ?? false;

  return (
    <FlowScreen title="Notificaciones" fallback={fallback}>
      {error ? <Notice tone="danger" text={error} /> : null}
      {items === null && !error ? <SkeletonRows count={4} /> : null}
      {items?.length === 0 ? (
        <EmptyState icon="bell" title="No tienes notificaciones" text="Aquí verás confirmaciones, recordatorios y avisos de pago." />
      ) : null}
      {items?.length ? (
        <View className="gap-2">
          {unread ? (
            <Pressable accessibilityRole="button" onPress={readAll} className="min-h-11 justify-center self-end active:opacity-60">
              <Text className="text-sm font-semibold text-primary">Marcar todo como leído</Text>
            </Pressable>
          ) : null}
          <List>
            {items.map((item) => (
              <NotificationRow key={item.id} item={item} onPress={() => void open(item)} />
            ))}
          </List>
          {hasMore ? <Button label="Ver anteriores" variant="outline" busy={loadingMore} onPress={loadMore} /> : null}
        </View>
      ) : null}
    </FlowScreen>
  );
}
