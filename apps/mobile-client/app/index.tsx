import { Redirect } from "expo-router";
import { ActivityIndicator } from "react-native";
import { useSession } from "../src/session";
import { color } from "../src/theme";

export default function Index() {
  const { user, ready } = useSession();
  if (!ready) return <ActivityIndicator className="flex-1 bg-surface" color={color.primary} accessibilityLabel="Cargando" />;
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={user.role === "staff" ? "/(staff)" : "/(customer)"} />;
}
