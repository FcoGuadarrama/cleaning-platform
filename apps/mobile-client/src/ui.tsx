import { Children, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "./icons";
import { color } from "./theme";

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const TONES: Record<Tone, { box: string; text: string; icon: string }> = {
  neutral: { box: "bg-surface", text: "text-text-muted", icon: color["text-muted"] },
  primary: { box: "bg-primary-soft", text: "text-primary", icon: color.primary },
  success: { box: "bg-success-soft", text: "text-success", icon: color.success },
  warning: { box: "bg-warning-soft", text: "text-warning", icon: color.warning },
  danger: { box: "bg-danger-soft", text: "text-danger", icon: color.danger },
};

const BUTTONS = {
  primary: { box: "bg-primary", text: "text-on-primary", spinner: color["on-primary"] },
  secondary: { box: "bg-primary-soft", text: "text-primary", spinner: color.primary },
  danger: { box: "bg-danger-soft", text: "text-danger", spinner: color.danger },
};

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: keyof typeof BUTTONS;
  busy?: boolean;
  disabled?: boolean;
  hint?: string;
  icon?: IconName;
}) {
  const v = BUTTONS[props.variant ?? "primary"];
  const inactive = props.disabled || props.busy;
  const textClass = props.disabled ? "text-on-disabled" : v.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityHint={props.hint}
      accessibilityState={{ disabled: inactive, busy: props.busy }}
      disabled={inactive}
      onPress={props.onPress}
      className={`min-h-[50px] flex-row items-center justify-center gap-2 rounded-lg px-5 active:opacity-80 ${props.disabled ? "bg-disabled" : v.box}`}
    >
      {props.busy ? (
        <ActivityIndicator color={v.spinner} accessibilityLabel="Cargando" />
      ) : (
        <>
          {props.icon ? <Icon name={props.icon} size={20} color={props.disabled ? color["on-disabled"] : v.spinner} /> : null}
          <Text className={`text-md font-semibold ${textClass}`}>{props.label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Root screen of a tab: safe-area aware, iOS-style large title, pull to refresh. */
export function Page(props: { title: string; subtitle?: string; children: ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-6 px-4 pb-10"
      contentContainerStyle={{ paddingTop: insets.top + 24 }}
      refreshControl={props.onRefresh ? <RefreshControl refreshing={props.refreshing ?? false} onRefresh={props.onRefresh} tintColor={color.primary} /> : undefined}
    >
      <View className="gap-1 px-1">
        <Text accessibilityRole="header" className="text-2xl font-bold tracking-[-0.6px] text-text">{props.title}</Text>
        {props.subtitle ? <Text className="text-md text-text-muted">{props.subtitle}</Text> : null}
      </View>
      {props.children}
    </ScrollView>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      {title ? <Text accessibilityRole="header" className="px-1 text-sm font-semibold text-text-muted">{title}</Text> : null}
      {children}
    </View>
  );
}

/** Inset grouped container: rows share one surface, divided by hairlines. */
export function Group({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View className="overflow-hidden rounded-lg bg-surface-raised">
      {items.map((child, i) => (
        <View key={i} className={i > 0 ? "border-t border-border/60" : undefined}>{child}</View>
      ))}
    </View>
  );
}

export function Row(props: {
  title: string;
  subtitle?: string;
  detail?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const body = (
    <View className="min-h-[60px] flex-row items-center gap-3 px-4 py-3">
      {props.leading}
      <View className="flex-1 gap-0.5">
        <Text className="text-md font-semibold text-text">{props.title}</Text>
        {props.subtitle ? <Text numberOfLines={2} className="text-sm text-text-muted">{props.subtitle}</Text> : null}
        {props.detail ? <Text className="text-xs text-text-muted">{props.detail}</Text> : null}
      </View>
      {props.trailing}
      {props.onPress ? <Icon name="chevron" size={18} color={color.border} strokeWidth={2.2} /> : null}
    </View>
  );
  if (!props.onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={props.accessibilityLabel ?? props.title} onPress={props.onPress} className="active:bg-surface">
      {body}
    </Pressable>
  );
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

const AVATAR = { md: "h-12 w-12", lg: "h-16 w-16", xl: "h-20 w-20" };
const AVATAR_TEXT = { md: "text-md", lg: "text-lg", xl: "text-xl" };

export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof AVATAR }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className={`${AVATAR[size]} items-center justify-center rounded-full bg-primary-soft`}>
      <Text className={`${AVATAR_TEXT[size]} font-semibold text-primary`}>{initials(name)}</Text>
    </View>
  );
}

export function Badge({ label, tone }: { label: string; tone: Tone }) {
  const t = TONES[tone];
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${t.box}`}>
      <Text className={`text-xs font-semibold ${t.text}`}>{label}</Text>
    </View>
  );
}

export function Notice({ text, tone = "primary", icon = "alert" }: { text: string; tone?: Tone; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" className={`flex-row items-start gap-3 rounded-lg p-4 ${t.box}`}>
      <Icon name={icon} size={20} color={t.icon} />
      <Text className={`flex-1 text-sm ${t.text}`}>{text}</Text>
    </View>
  );
}

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  return (
    <View className="gap-1.5">
      <Text className="px-1 text-sm font-medium text-text">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color["text-muted"]}
        className="min-h-[50px] rounded-lg border border-border bg-surface-raised px-4 text-md text-text focus:border-primary"
        {...input}
      />
    </View>
  );
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  return (
    <View className="items-center gap-3 rounded-lg bg-surface-raised px-6 py-10">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
        <Icon name={icon} size={26} color={color.primary} />
      </View>
      <Text className="text-center text-md font-semibold text-text">{title}</Text>
      {text ? <Text className="text-center text-sm text-text-muted">{text}</Text> : null}
    </View>
  );
}

export function StateView(props: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyTitle: string;
  emptyText?: string;
  emptyIcon?: IconName;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (props.loading) return <ActivityIndicator className="py-10" color={color.primary} accessibilityLabel="Cargando" />;
  if (props.error)
    return (
      <View className="gap-3">
        <Notice tone="danger" text={props.error} />
        <Button label="Reintentar" variant="secondary" onPress={props.onRetry} />
      </View>
    );
  if (props.empty) return <EmptyState icon={props.emptyIcon ?? "calendar"} title={props.emptyTitle} text={props.emptyText} />;
  return <>{props.children}</>;
}
