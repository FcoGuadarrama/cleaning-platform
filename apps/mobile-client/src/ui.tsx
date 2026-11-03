import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

const VARIANTS = {
  primary: { box: "bg-primary", text: "text-on-primary" },
  secondary: { box: "bg-surface border border-border", text: "text-text" },
  danger: { box: "bg-danger", text: "text-on-danger" },
};

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: keyof typeof VARIANTS;
  busy?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const v = VARIANTS[props.variant ?? "primary"];
  const inactive = props.disabled || props.busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityHint={props.hint}
      accessibilityState={{ disabled: inactive, busy: props.busy }}
      disabled={inactive}
      onPress={props.onPress}
      className={`min-h-11 items-center justify-center rounded-md px-4 ${inactive ? "bg-disabled" : v.box}`}
    >
      {props.busy ? (
        <ActivityIndicator accessibilityLabel="Cargando" />
      ) : (
        <Text className={`text-md font-semibold ${inactive ? "text-on-disabled" : v.text}`}>{props.label}</Text>
      )}
    </Pressable>
  );
}

export function StateView(props: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyText: string;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (props.loading) return <ActivityIndicator className="p-6" accessibilityLabel="Cargando" />;
  if (props.error)
    return (
      <View accessibilityRole="alert" className="gap-3 p-4">
        <Text className="text-md text-danger">{props.error}</Text>
        <Button label="Reintentar" variant="secondary" onPress={props.onRetry} />
      </View>
    );
  if (props.empty) return <Text className="p-6 text-md text-text-muted">{props.emptyText}</Text>;
  return <>{props.children}</>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View className="gap-2 rounded-lg bg-surface-raised p-4 shadow-sm">{children}</View>;
}
