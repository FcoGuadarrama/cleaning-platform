import { createApiClient, type ApiError } from "@repo/api-client";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "session.token";
let cached: string | null = null;

export const tokenStore = {
  async load(): Promise<string | null> {
    cached = await SecureStore.getItemAsync(TOKEN_KEY);
    return cached;
  },
  async save(token: string): Promise<void> {
    cached = token;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  async clear(): Promise<void> {
    cached = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
export const api = createApiClient({ baseUrl, getToken: () => cached });

export function errorMessage(error: unknown): string {
  const e = error as Partial<ApiError> | undefined;
  return e?.message ?? "Ocurrió un error inesperado. Intenta de nuevo.";
}
