import createClient, { type Middleware } from "openapi-fetch";
import type { components, paths } from "./schema";

export type { components, paths };
export type Schemas = components["schemas"];
export type ApiError = Schemas["ErrorResponse"];

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => string | null | Promise<string | null>;
}

export function createApiClient({ baseUrl, getToken }: ApiClientOptions) {
  const client = createClient<paths>({ baseUrl });
  const auth: Middleware = {
    async onRequest({ request }) {
      const token = await getToken();
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
  };
  // A request that never got an answer (offline, timeout) resolves as an error response instead of throwing, so
  // callers keep their state and can retry; creates are safe to retry with their Idempotency-Key.
  const network: Middleware = {
    onError() {
      const body: ApiError = { code: "network_error", message: "No hay conexión con el servidor. Intenta de nuevo." };
      return new Response(JSON.stringify(body), { status: 503, headers: { "Content-Type": "application/json" } });
    },
  };
  client.use(auth, network);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
