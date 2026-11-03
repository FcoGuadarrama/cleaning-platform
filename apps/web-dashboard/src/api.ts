import { createApiClient, type ApiError } from "@repo/api-client";

const TOKEN_KEY = "dashboard.token";

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export const api = createApiClient({ baseUrl: "/api", getToken: tokenStore.get });

export function errorMessage(error: unknown): string {
  const e = error as Partial<ApiError> | undefined;
  return e?.message ?? "Ocurrió un error inesperado. Intenta de nuevo.";
}
