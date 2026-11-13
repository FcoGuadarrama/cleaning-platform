import type { Schemas } from "@repo/api-client";
import * as Notifications from "expo-notifications";
import { router, type Href } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { api } from "./api";
import { registerForPush } from "./push";
import { useSession } from "./session";

type Role = Schemas["Role"];
type Data = Record<string, unknown>;

interface Inbox {
  unread: number;
  refresh: () => Promise<void>;
}

const InboxContext = createContext<Inbox | null>(null);

const mobileRole = (role: Role | undefined): role is "customer" | "staff" => role === "customer" || role === "staff";

/** Unread count for the bell, refreshed on sign-in, when the app comes back to the foreground and when a push lands. */
export function InboxProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const signedIn = mobileRole(user?.role);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!signedIn) {
      setUnread(0);
      return;
    }
    const { data } = await api.GET("/notifications/unread-count");
    if (data) setUnread(data.count);
  }, [signedIn]);

  useEffect(() => {
    void refresh();
    if (signedIn) void registerForPush();
  }, [refresh, signedIn, user?.id]);

  useEffect(() => {
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    const received = Platform.OS === "web" ? null : Notifications.addNotificationReceivedListener(() => void refresh());
    return () => {
      foreground.remove();
      received?.remove();
    };
  }, [refresh]);

  return <InboxContext.Provider value={{ unread, refresh }}>{children}</InboxContext.Provider>;
}

export function useInbox(): Inbox {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error("useInbox outside InboxProvider");
  return ctx;
}

const id = (value: unknown) => (typeof value === "number" ? String(value) : null);

/** The screen a notification is about, from the ids the API put in `data`; null keeps the user in the inbox. */
export function notificationTarget(role: "customer" | "staff", data: Data): Href | null {
  const booking = id(data.booking_id);
  if (role === "customer") {
    if (booking) return { pathname: "/(customer)/booking/[id]", params: { id: booking } };
    if (id(data.subscription_id)) return "/(customer)/subscription";
    return null;
  }
  if (booking) return { pathname: "/(staff)/job/[id]", params: { id: booking } };
  if (id(data.settlement_id)) return "/(staff)/(tabs)/earnings";
  return null;
}

export const inboxRoute = (role: "customer" | "staff"): Href => (role === "customer" ? "/(customer)/notifications" : "/(staff)/notifications");

/** Opens what a tapped push is about (or the inbox) and marks it read; also handles the tap that launched the app. */
export function usePushTaps() {
  const { user } = useSession();
  const { refresh } = useInbox();
  const role = user?.role;

  useEffect(() => {
    if (Platform.OS === "web" || !mobileRole(role)) return;
    let mounted = true;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!mounted || !response) return;
      Notifications.clearLastNotificationResponse();
      const data = response.notification.request.content.data ?? {};
      const notificationId = id(data.notification_id);
      if (notificationId) {
        void api.POST("/notifications/{notification_id}/read", { params: { path: { notification_id: Number(notificationId) } } }).then(() => refresh());
      }
      router.push(notificationTarget(role, data) ?? inboxRoute(role));
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      mounted = false;
      tapped.remove();
    };
  }, [role, refresh]);
}
