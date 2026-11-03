import type { Schemas } from "@repo/api-client";
import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { useSession } from "./session";

/** Navigation convenience only — the API enforces roles and ownership. */
export function RoleGate({ role, children }: { role: Schemas["Role"]; children: ReactNode }) {
  const { user, ready } = useSession();
  if (ready && user?.role !== role) return <Redirect href="/" />;
  return <>{children}</>;
}
