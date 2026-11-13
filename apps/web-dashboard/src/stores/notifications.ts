import { defineStore } from "pinia";
import { computed } from "vue";
import { api, errorMessage } from "../api";
import { useResource } from "../useResource";
import { toNotificationItem } from "../viewmodels/notifications";

const RECENT = 20;

/** The admin's inbox: unread count for the bell (polled with the live data) and the latest notices. */
export const useNotifications = defineStore("notifications", () => {
  const unread = useResource(() => api.GET("/notifications/unread-count"));
  const recent = useResource(() => api.GET("/notifications", { params: { query: { limit: RECENT } } }));

  const items = computed(() => (recent.data ?? []).map(toNotificationItem));
  const unreadCount = computed(() => unread.data?.count ?? 0);

  async function refresh(options?: { background?: boolean }): Promise<void> {
    await Promise.all([unread.refresh(options), recent.refresh(options)]);
  }

  async function markRead(id: number): Promise<string | null> {
    const { error } = await api.POST("/notifications/{notification_id}/read", { params: { path: { notification_id: id } } });
    if (error) return errorMessage(error);
    await refresh({ background: true });
    return null;
  }

  async function markAllRead(): Promise<string | null> {
    const { error } = await api.POST("/notifications/read-all");
    if (error) return errorMessage(error);
    await refresh({ background: true });
    return null;
  }

  return { unread, recent, items, unreadCount, refresh, markRead, markAllRead };
});
