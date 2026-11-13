import { Tabs } from "expo-router";
import { color } from "./theme";
import { FloatingTabBar, type TabIcons } from "./TabBar";
import type { IconName } from "./icons";

export const stackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: color.background },
};

export type TabSpec = { name: string; title: string; icon: IconName };

/** Bottom tabs rendered as a floating glass capsule; scenes run full height and scroll beneath it. */
export function AppTabs({ tabs }: { tabs: TabSpec[] }) {
  const icons: TabIcons = Object.fromEntries(tabs.map((t) => [t.name, t.icon]));
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} icons={icons} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.background } }}
    >
      {tabs.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
      ))}
    </Tabs>
  );
}
