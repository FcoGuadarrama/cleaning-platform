import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { prefs } from "../src/prefs";
import { useSession } from "../src/session";
import { color } from "../src/theme";

export default function Index() {
  const { user, ready } = useSession();
  const [seenWelcome, setSeenWelcome] = useState<boolean | null>(null);

  useEffect(() => {
    void prefs.get("welcome.seen").then((v) => setSeenWelcome(v === "1"));
  }, []);

  if (!ready || seenWelcome === null) return <ActivityIndicator className="flex-1 bg-background" color={color.primary} accessibilityLabel="Cargando" />;
  if (!user) return <Redirect href={seenWelcome ? "/login" : "/welcome"} />;
  return <Redirect href={user.role === "staff" ? "/(staff)/(tabs)" : "/(customer)/(tabs)"} />;
}
