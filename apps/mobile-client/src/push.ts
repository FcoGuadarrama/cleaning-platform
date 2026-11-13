import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

/** Push only exists on a physical iOS/Android device with an EAS project id (set by `eas init` in app.json). */
const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
export const pushSupported = Platform.OS !== "web" && Device.isDevice && !!projectId;

// The token registered for the signed-in user, so sign-out can stop this phone from receiving their push.
let registered: string | null = null;

if (Platform.OS !== "web") {
  // A push that arrives while the app is open still shows as a banner; the inbox badge refreshes on its own.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export type PushPermission = "granted" | "denied" | "undetermined" | "unsupported";

export async function pushPermission(): Promise<PushPermission> {
  if (!pushSupported) return "unsupported";
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/** Asks for permission once (the OS remembers a refusal) and registers this phone's token for the user. */
export async function registerForPush(): Promise<PushPermission> {
  if (!pushSupported) return "unsupported";
  if (Platform.OS === "android") {
    // The API sends every push to this channel (push.ANDROID_CHANNEL); Android 13+ asks for permission after it exists.
    await Notifications.setNotificationChannelAsync("default", { name: "Avisos", importance: Notifications.AndroidImportance.HIGH });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status === "undetermined") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return status;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await api.PUT("/push-devices", { body: { token, platform: Platform.OS === "ios" ? "ios" : "android" } });
  if (error === undefined) registered = token;
  return status;
}

/** Before sign-out, while the session token still authenticates the request. A failure must not block sign-out. */
export async function unregisterPush(): Promise<void> {
  if (!registered) return;
  const token = registered;
  registered = null;
  try {
    await api.DELETE("/push-devices/{token}", { params: { path: { token } } });
  } catch (error) {
    console.warn("push token not unregistered", error);
  }
}
