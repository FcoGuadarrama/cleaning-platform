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
  client.use(auth);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
