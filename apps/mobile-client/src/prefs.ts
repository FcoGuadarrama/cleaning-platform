import { getItemAsync, setItemAsync } from "expo-secure-store";

/** Small device-local preferences (not secrets, not shared). */
export const prefs = {
  get: (key: string) => getItemAsync(`pref.${key}`),
  set: (key: string, value: string) => setItemAsync(`pref.${key}`, value),
};
