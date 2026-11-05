import { Children, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { Icon, type IconName } from "./icons";
import { alpha, color, shadow } from "./theme";

export type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger";

const TONES: Record<Tone, { box: string; text: string; icon: string }> = {
  neutral: { box: "bg-surface", text: "text-text-muted", icon: color["text-muted"] },
  primary: { box: "bg-primary-soft", text: "text-primary", icon: color.primary },
  accent: { box: "bg-accent-soft", text: "text-text", icon: color.text },
  success: { box: "bg-success-soft", text: "text-success", icon: color.success },
  warning: { box: "bg-warning-soft", text: "text-warning", icon: color.warning },
  danger: { box: "bg-danger-soft", text: "text-danger", icon: color.danger },
};

const CYCLE: Tone[] = ["primary", "accent", "success", "warning"];

/** Stable decorative tone for a person or item, so the same cleaner always gets the same color. */
export const toneFor = (seed: number) => CYCLE[Math.abs(seed) % CYCLE.length]!;

/* ---------- Brand surfaces ---------- */

/** Soap-bubble motif: the one decorative element, drawn in on-primary so it follows the brand. */
export function Bubbles() {
  const ink = color["on-primary"];
  return (
    <Svg style={{ position: "absolute", top: -30, right: -50 }} width={280} height={260} viewBox="0 0 280 260">
      <Circle cx={190} cy={80} r={96} fill={alpha(ink, 0.07)} />
      <Circle cx={92} cy={46} r={26} fill="none" stroke={alpha(ink, 0.22)} strokeWidth={1.5} />
      <Path d="M80 38a14 14 0 0 1 9-9" stroke={alpha(ink, 0.4)} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Circle cx={248} cy={200} r={22} fill="none" stroke={alpha(ink, 0.2)} strokeWidth={1.5} />
      <Path d="M238 193a10 10 0 0 1 7-7" stroke={alpha(ink, 0.4)} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Circle cx={150} cy={150} r={7} fill={alpha(ink, 0.18)} />
      <Circle cx={200} cy={230} r={4} fill={alpha(ink, 0.22)} />
    </Svg>
  );
}

/** Colored header of a root screen; the content below overlaps its rounded bottom edge. */
export function Hero({ children, overlap = true }: { children: ReactNode; overlap?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View className={`overflow-hidden rounded-b-2xl bg-primary px-5 ${overlap ? "pb-16" : "pb-8"}`} style={{ paddingTop: insets.top + 20 }}>
      <Bubbles />
      {children}
    </View>
  );
}

export function HeroText({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) {
  return (
    <View className="gap-1.5">
      {kicker ? <Text className="text-md font-medium text-on-primary opacity-80">{kicker}</Text> : null}
      <Text accessibilityRole="header" className="text-2xl font-extrabold tracking-[-0.8px] text-on-primary">{title}</Text>
      {subtitle ? <Text className="text-md text-on-primary opacity-80">{subtitle}</Text> : null}
    </View>
  );
}

/** Root screen of a tab: hero header, overlapping content, room for the floating tab bar. */
export function HeroPage(props: { hero: ReactNode; children: ReactNode; onRefresh?: () => void; refreshing?: boolean; overlap?: boolean }) {
  const overlap = props.overlap ?? true;
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="pb-36"
      refreshControl={props.onRefresh ? <RefreshControl refreshing={props.refreshing ?? false} onRefresh={props.onRefresh} tintColor={color["on-primary"]} /> : undefined}
    >
      <Hero overlap={overlap}>{props.hero}</Hero>
      <View className={`gap-7 px-4 ${overlap ? "-mt-10" : "pt-6"}`}>{props.children}</View>
    </ScrollView>
  );
}

/* ---------- Building blocks ---------- */

export function Card({ children, className = "", onPress, accessibilityLabel }: { children: ReactNode; className?: string; onPress?: () => void; accessibilityLabel?: string }) {
  const box = `rounded-xl bg-surface-raised p-4 ${className}`;
  if (!onPress) return <View className={box} style={shadow("2")}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} className={`${box} active:opacity-90`} style={shadow("2")}>
      {children}
    </Pressable>
  );
}

export function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <View className="flex-row items-baseline justify-between px-1">
      <Text accessibilityRole="header" className="text-lg font-bold tracking-[-0.3px] text-text">{title}</Text>
      {detail ? <Text className="text-sm text-text-muted">{detail}</Text> : null}
    </View>
  );
}

const BUTTONS = {
  primary: { box: "bg-primary", text: "text-on-primary", ink: color["on-primary"] },
  soft: { box: "bg-primary-soft", text: "text-primary", ink: color.primary },
  light: { box: "bg-surface-raised", text: "text-primary", ink: color.primary },
  danger: { box: "bg-danger-soft", text: "text-danger", ink: color.danger },
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
  const variant = props.variant ?? "primary";
  const v = BUTTONS[variant];
  const inactive = props.disabled || props.busy;
  const lift = !props.disabled && variant === "primary" ? shadow("2", color.primary) : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityHint={props.hint}
      accessibilityState={{ disabled: inactive, busy: props.busy }}
      disabled={inactive}
      onPress={props.onPress}
      style={lift}
      className={`min-h-[54px] flex-row items-center justify-center gap-2 rounded-full px-6 active:opacity-85 ${props.disabled ? "bg-disabled" : v.box}`}
    >
      {props.busy ? (
        <ActivityIndicator color={v.ink} accessibilityLabel="Cargando" />
      ) : (
        <>
          {props.icon ? <Icon name={props.icon} size={20} color={props.disabled ? color["on-disabled"] : v.ink} strokeWidth={2.2} /> : null}
          <Text className={`text-md font-bold ${props.disabled ? "text-on-disabled" : v.text}`}>{props.label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconTile({ icon, tone = "primary", size = 48 }: { icon: IconName; tone?: Tone; size?: number }) {
  const t = TONES[tone];
  return (
    <View className={`items-center justify-center rounded-lg ${t.box}`} style={{ width: size, height: size }}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={t.icon} strokeWidth={2} />
    </View>
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

const AVATAR_SIZE = { sm: 40, md: 52, lg: 64, xl: 88 };
const AVATAR_TEXT = { sm: "text-sm", md: "text-md", lg: "text-xl", xl: "text-2xl" };

export function Avatar({ name, tone = "primary", size = "md", ring = false }: { name: string; tone?: Tone; size?: keyof typeof AVATAR_SIZE; ring?: boolean }) {
  const t = TONES[tone];
  const px = AVATAR_SIZE[size];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`items-center justify-center rounded-full ${t.box} ${ring ? "border-4 border-surface-raised" : ""}`}
      style={{ width: px, height: px }}
    >
      <Text className={`${AVATAR_TEXT[size]} font-bold ${t.text}`}>{initials(name)}</Text>
    </View>
  );
}

export function Badge({ label, tone }: { label: string; tone: Tone }) {
  const t = TONES[tone];
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${t.box}`}>
      <Text className={`text-xs font-bold ${t.text}`}>{label}</Text>
    </View>
  );
}

export function Notice({ text, tone = "primary", icon = "alert" }: { text: string; tone?: Tone; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" className={`flex-row items-start gap-3 rounded-xl p-4 ${t.box}`}>
      <Icon name={icon} size={20} color={t.icon} />
      <Text className={`flex-1 text-sm font-medium ${t.text}`}>{text}</Text>
    </View>
  );
}

export function Field({ label, icon, onFocus, onBlur, ...input }: { label: string; icon?: IconName } & TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View className="gap-2">
      <Text className="px-1 text-sm font-semibold text-text">{label}</Text>
      <View className={`min-h-[54px] flex-row items-center gap-3 rounded-lg border-2 bg-surface-raised px-4 ${focused ? "border-primary" : "border-border/70"}`}>
        {icon ? <Icon name={icon} size={20} color={focused ? color.primary : color["text-muted"]} /> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={color["text-muted"]}
          className="min-h-[50px] flex-1 text-md text-text web:outline-none"
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...input}
        />
      </View>
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View accessibilityRole="tablist" className="flex-row rounded-full bg-surface-raised p-1" style={shadow("1")}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            className={`min-h-11 flex-1 items-center justify-center rounded-full ${on ? "bg-primary" : ""}`}
          >
            <Text className={`text-sm font-bold ${on ? "text-on-primary" : "text-text-muted"}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Rows sharing one raised surface, divided by hairlines (settings-style lists). */
export function Group({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View className="overflow-hidden rounded-xl bg-surface-raised" style={shadow("1")}>
      {items.map((child, i) => (
        <View key={i} className={i > 0 ? "border-t border-border/50" : undefined}>{child}</View>
      ))}
    </View>
  );
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  return (
    <View className="items-center gap-3 rounded-xl bg-surface-raised px-6 py-10" style={shadow("1")}>
      <IconTile icon={icon} size={60} />
      <Text className="text-center text-md font-bold text-text">{title}</Text>
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
        <Button label="Reintentar" variant="soft" onPress={props.onRetry} />
      </View>
    );
  if (props.empty) return <EmptyState icon={props.emptyIcon ?? "calendar"} title={props.emptyTitle} text={props.emptyText} />;
  return <>{props.children}</>;
}
