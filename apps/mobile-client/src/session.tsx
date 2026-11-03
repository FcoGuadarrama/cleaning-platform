import type { Schemas } from "@repo/api-client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, errorMessage, tokenStore } from "./api";

type User = Schemas["UserOut"];
interface Session {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string, fullName: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      if (await tokenStore.load()) {
        const { data } = await api.GET("/auth/me");
        if (data) setUser(data);
        else await tokenStore.clear();
      }
      setReady(true);
    })();
  }, []);

  async function accept(result: { data?: Schemas["TokenOut"]; error?: unknown }): Promise<string | null> {
    if (!result.data) return errorMessage(result.error);
    if (result.data.user.role === "admin") return "Las cuentas de administración usan el panel web.";
    await tokenStore.save(result.data.access_token);
    setUser(result.data.user);
    return null;
  }

  const value: Session = {
    user,
    ready,
    login: async (email, password) => accept(await api.POST("/auth/login", { body: { email, password } })),
    register: async (email, password, full_name) =>
      accept(await api.POST("/auth/register", { body: { email, password, full_name } })),
    logout: async () => {
      await tokenStore.clear();
      setUser(null);
    },
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside SessionProvider");
  return ctx;
}
