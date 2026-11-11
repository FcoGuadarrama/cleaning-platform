import { createApiClient, type ApiError } from "@repo/api-client";
import { deleteSessionToken, getSessionToken, setSessionToken } from "./session-storage";

const TOKEN_KEY = "session.token";
let cached: string | null = null;

export const tokenStore = {
  async load(): Promise<string | null> {
    cached = await getSessionToken(TOKEN_KEY);
    return cached;
  },
  async save(token: string): Promise<void> {
    await setSessionToken(TOKEN_KEY, token);
    cached = token;
  },
  async clear(): Promise<void> {
    await deleteSessionToken(TOKEN_KEY);
    cached = null;
  },
};

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
export const api = createApiClient({ baseUrl, getToken: () => cached });

export function errorCode(error: unknown): string | undefined {
  return (error as Partial<ApiError> | undefined)?.code;
}

export function errorMessage(error: unknown): string {
  const e = error as Partial<ApiError> | undefined;
  return e?.message ?? "Ocurrió un error inesperado. Intenta de nuevo.";
}
