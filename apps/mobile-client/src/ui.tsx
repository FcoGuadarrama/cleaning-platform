import { tokens } from "@repo/design-tokens/native";
import { Children, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, TextInput, View, type TextInputProps } from "react-native";
import { Icon, type IconName } from "./icons";
import { PressableScale, Skeleton } from "./motion";
import { Text } from "./text";
import { color } from "./theme";

/* ---------- Brand ---------- */

/** Brand name as the wordmark spells it, until brand.json `assets.logo` holds the drawn logo. */
export const BRAND = tokens.name.toLowerCase();
export const BRAND_NAME = tokens.name;

export function Wordmark() {
  return (
    <Text accessibilityRole="header" accessibilityLabel={BRAND_NAME} className="text-[36px] font-bold leading-[40px] tracking-[-1.4px] text-primary">
      {BRAND}
    </Text>
  );
}

/* ---------- Tones ---------- */

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

export const TONES: Record<Tone, { soft: string; text: string; ink: string; solid: string; on: string }> = {
  neutral: { soft: "bg-surface", text: "text-text-muted", ink: color["text-muted"], solid: "bg-text-muted", on: color.background },
  primary: { soft: "bg-primary-soft", text: "text-primary", ink: color.primary, solid: "bg-primary", on: color["on-primary"] },
  success: { soft: "bg-success-soft", text: "text-success", ink: color.success, solid: "bg-success", on: color["on-success"] },
  warning: { soft: "bg-warning-soft", text: "text-warning", ink: color.warning, solid: "bg-warning", on: color["on-warning"] },
  danger: { soft: "bg-danger-soft", text: "text-danger", ink: color.danger, solid: "bg-danger", on: color["on-danger"] },
};

/* ---------- Type ---------- */

/** Big screen title, optionally under a small uppercase kicker. */
export function LargeTitle({ overline, title, trailing }: { overline?: string; title: string; trailing?: ReactNode }) {
  return (
    <View className="gap-1.5">
      {overline ? <Overline>{overline}</Overline> : null}
      <View className="flex-row items-center justify-between gap-3">
        <Text accessibilityRole="header" className="flex-1 text-2xl font-bold leading-[40px] tracking-[-1px] text-text">{title}</Text>
        {trailing}
      </View>
    </View>
  );
}

export function Overline({ children }: { children: ReactNode }) {
  return <Text className="text-xs font-semibold uppercase tracking-[1.6px] text-text">{children}</Text>;
}

export function SectionTitle({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text accessibilityRole="header" className="flex-1 text-lg font-semibold tracking-[-0.3px] text-text">{title}</Text>
      {trailing}
    </View>
  );
}

/* ---------- "Próximamente" ---------- */

/** Marks a designed feature the product does not support yet (see docs/rfc/brisa-feature-gaps.md). */
export function Soon() {
  return (
    <View className="rounded-full bg-surface px-2.5 py-1">
      <Text className="text-xs font-semibold text-text-muted">Próximamente</Text>
    </View>
  );
}

/* ---------- Surfaces ---------- */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-lg border border-border bg-background p-4 ${className}`}>{children}</View>;
}

export function Hairline({ className = "" }: { className?: string }) {
  return <View className={`h-px bg-border ${className}`} />;
}

/** Soft brand panel: icon, a thin divider, then the message (tips and help prompts). */
export function Callout({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <View className="flex-row items-center gap-4 rounded-lg bg-primary-soft px-4 py-4">
      <Icon name={icon} size={30} color={color.text} strokeWidth={1.5} />
      <View className="w-px self-stretch bg-primary/25" />
      <View className="flex-1 gap-1">{children}</View>
    </View>
  );
}

export function InfoNote({ text }: { text: string }) {
  return (
    <View className="flex-row items-start gap-2.5">
      <Icon name="info" size={18} color={color.text} strokeWidth={1.6} />
      <Text className="flex-1 text-sm text-text">{text}</Text>
    </View>
  );
}

/* ---------- Lists ---------- */

/** Rows divided by hairlines, with a rule above the first one (settings-style list on white). */
export function List({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View className="border-t border-border">
      {items.map((child, i) => (
        <View key={i} className="border-b border-border">{child}</View>
      ))}
    </View>
  );
}

export function Row(props: {
  icon?: IconName;
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  soon?: boolean;
  accessibilityLabel?: string;
}) {
  const pressable = !!props.onPress && !props.soon;
  // A custom trailing control (check mark, link) replaces the navigation arrow.
  const arrow = pressable && !props.trailing;
  const content = (
    <>
      {props.leading ?? (props.icon ? <Icon name={props.icon} size={24} color={color.text} strokeWidth={1.5} /> : null)}
      <View className="flex-1 gap-0.5">
        <Text className="text-md font-semibold text-text">{props.title}</Text>
        {props.subtitle ? <Text numberOfLines={2} className="text-sm text-text-muted">{props.subtitle}</Text> : null}
      </View>
      {props.value ? <Text className="max-w-[55%] text-right text-md text-text">{props.value}</Text> : null}
      {props.trailing}
      {props.soon ? <Soon /> : arrow ? <Icon name="arrow" size={20} color={color.text} strokeWidth={1.6} /> : null}
    </>
  );
  const box = "min-h-[60px] flex-row items-center gap-4 py-3";
  if (!pressable) return <View accessibilityLabel={props.soon ? `${props.title}, próximamente` : undefined} className={box}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={props.accessibilityLabel ?? props.title} onPress={props.onPress} className={`${box} active:opacity-60`}>
      {content}
    </Pressable>
  );
}

/* ---------- Controls ---------- */

const BUTTONS = {
  primary: { box: "bg-primary", text: "text-on-primary", ink: color["on-primary"] },
  outline: { box: "border border-border bg-background", text: "text-primary", ink: color.primary },
  outlinePrimary: { box: "border-[1.5px] border-primary bg-background", text: "text-primary", ink: color.primary },
  danger: { box: "bg-danger", text: "text-on-danger", ink: color["on-danger"] },
};

export function Button(props: {
  label: string;
  onPress?: () => void;
  variant?: keyof typeof BUTTONS;
  busy?: boolean;
  disabled?: boolean;
  soon?: boolean;
  hint?: string;
  icon?: IconName;
  compact?: boolean;
  className?: string;
}) {
  const v = BUTTONS[props.variant ?? "primary"];
  const off = props.disabled || props.soon;
  const filled = !(props.variant ?? "primary").startsWith("outline");
  const box = off ? (filled ? "bg-disabled" : "border border-border bg-background") : v.box;
  const text = off ? (filled ? "text-on-disabled" : "text-text-muted") : v.text;
  const ink = off ? color["text-muted"] : v.ink;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={props.soon ? `${props.label}, próximamente` : props.label}
      accessibilityHint={props.hint}
      accessibilityState={{ disabled: off || props.busy, busy: props.busy }}
      disabled={off || props.busy}
      onPress={props.onPress}
      scaleTo={0.98}
      className={`${props.compact ? "min-h-11 px-3" : "min-h-[52px] px-5"} flex-row items-center justify-center gap-2 rounded-md ${box} ${props.className ?? ""}`}
    >
      {props.busy ? (
        <ActivityIndicator color={ink} accessibilityLabel="Cargando" />
      ) : (
        <>
          {props.icon ? <Icon name={props.icon} size={props.compact ? 18 : 22} color={ink} strokeWidth={1.7} /> : null}
          <Text className={`${props.compact ? "text-sm" : "text-md"} font-semibold ${text}`}>{props.label}</Text>
        </>
      )}
    </PressableScale>
  );
}

/** Inline brand link with a trailing arrow ("Ver qué incluye →"). */
export function TextLink({ label, onPress, soon }: { label: string; onPress?: () => void; soon?: boolean }) {
  if (soon)
    return (
      <View accessibilityLabel={`${label}, próximamente`} className="min-h-11 flex-row items-center gap-2 self-start">
        <Text className="text-md font-semibold text-text-muted">{label}</Text>
        <Soon />
      </View>
    );
  return (
    <Pressable accessibilityRole="link" onPress={onPress} className="min-h-11 flex-row items-center gap-1.5 self-start active:opacity-60">
      <Text className="text-md font-semibold text-primary">{label}</Text>
      <Icon name="arrow" size={18} color={color.primary} strokeWidth={1.8} />
    </Pressable>
  );
}

/** Underlined tabs ("Próximas · Historial"). */
export function UnderlineTabs<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View accessibilityRole="tablist" className="flex-row border-b border-border">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} className="min-h-12 flex-1 items-center justify-center">
            <Text className={`text-md ${on ? "font-semibold text-primary" : "text-text"}`}>{o.label}</Text>
            <View className={`absolute bottom-[-1px] h-[3px] w-full rounded-full ${on ? "bg-primary" : ""}`} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, icon, onFocus, onBlur, ...input }: { label: string; icon?: IconName } & TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-text">{label}</Text>
      <View className={`min-h-[52px] flex-row items-center gap-3 rounded-md border bg-background px-4 ${focused ? "border-primary" : "border-border"}`}>
        {icon ? <Icon name={icon} size={20} color={focused ? color.primary : color["text-muted"]} strokeWidth={1.6} /> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={color["text-muted"]}
          className="min-h-[50px] flex-1 font-normal text-md text-text web:outline-none"
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...input}
        />
      </View>
    </View>
  );
}

/* ---------- People and status ---------- */

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

const AVATAR = { xs: [32, "text-xs"], sm: [44, "text-sm"], md: [56, "text-md"], lg: [72, "text-xl"], xl: [92, "text-2xl"] } as const;

/** Initials until staff and customer photos exist (docs/rfc/brisa-feature-gaps.md). */
export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof AVATAR }) {
  const [px, text] = AVATAR[size];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="items-center justify-center rounded-full bg-primary-soft" style={{ width: px, height: px }}>
      <Text className={`${text} font-semibold text-primary`}>{initials(name)}</Text>
    </View>
  );
}

const STATUS_ICON: Record<Tone, IconName> = { success: "check", primary: "clock", warning: "clock", danger: "alert", neutral: "alert" };

/** Round status mark: check for success, clock while pending. */
export function StatusDot({ tone, size = 20 }: { tone: Tone; size?: number }) {
  return (
    <View className={`items-center justify-center rounded-full ${TONES[tone].solid}`} style={{ width: size, height: size }}>
      <Icon name={STATUS_ICON[tone]} size={Math.round(size * 0.62)} color={TONES[tone].on} strokeWidth={2.6} />
    </View>
  );
}

/** "✓ Confirmada" line inside cards. */
export function StatusLine({ label, tone }: { label: string; tone: Tone }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <StatusDot tone={tone} size={18} />
      <Text className={`text-sm font-medium ${TONES[tone].text}`}>{label}</Text>
    </View>
  );
}

/** Status pill at the top of a detail screen. */
export function StatusChip({ label, tone }: { label: string; tone: Tone }) {
  return (
    <View className={`flex-row items-center gap-1.5 self-start rounded-md px-2 py-1 ${TONES[tone].soft}`}>
      <StatusDot tone={tone} size={18} />
      <Text className={`text-sm font-medium ${TONES[tone].text}`}>{label}</Text>
    </View>
  );
}

export function Notice({ text, tone = "primary" }: { text: string; tone?: Tone }) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" className={`flex-row items-start gap-3 rounded-lg p-4 ${TONES[tone].soft}`}>
      <Icon name={tone === "success" ? "check" : "info"} size={20} color={TONES[tone].ink} strokeWidth={1.8} />
      <Text className={`flex-1 text-sm font-medium ${TONES[tone].text}`}>{text}</Text>
    </View>
  );
}

/* ---------- States ---------- */

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <View className="items-center gap-3 rounded-lg border border-border px-6 py-8">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
        <Icon name={icon} size={26} color={color.primary} strokeWidth={1.6} />
      </View>
      <Text className="text-center text-md font-semibold text-text">{title}</Text>
      {text ? <Text className="text-center text-sm text-text-muted">{text}</Text> : null}
      {action}
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
  skeleton?: ReactNode;
  children: ReactNode;
}) {
  if (props.loading) return <>{props.skeleton ?? <SkeletonRows />}</>;
  if (props.error)
    return (
      <View className="gap-3">
        <Notice tone="danger" text={props.error} />
        <Button label="Reintentar" variant="outline" onPress={props.onRetry} />
      </View>
    );
  if (props.empty) return <EmptyState icon={props.emptyIcon ?? "calendar"} title={props.emptyTitle} text={props.emptyText} />;
  return <>{props.children}</>;
}

/** Placeholder rows shaped like the list that is loading. */
export function SkeletonRows({ count = 2 }: { count?: number }) {
  return (
    <View accessibilityLabel="Cargando" className="border-t border-border">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} className="flex-row items-center gap-4 border-b border-border py-4">
          <Skeleton className="h-6 w-6 rounded-md" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonCard() {
  return (
    <View accessibilityLabel="Cargando" className="gap-4 rounded-lg border border-border p-4">
      <View className="flex-row gap-4">
        <Skeleton className="h-[84px] w-[76px] rounded-md" />
        <View className="flex-1 gap-2 pt-1">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-3 w-1/3" />
        </View>
      </View>
      <Skeleton className="h-12 w-full rounded-md" />
    </View>
  );
}
