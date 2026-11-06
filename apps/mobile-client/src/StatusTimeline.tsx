import type { Schemas } from "@repo/api-client";
import { Text, View } from "react-native";
import { Icon } from "./icons";
import { color } from "./theme";

type Status = Schemas["BookingStatus"];

const STEPS = ["Reservada", "Confirmada", "En curso", "Completada"] as const;

/** Position of a booking along held → confirmed → in_progress → completed; null for terminal side states. */
const POSITION: Partial<Record<Status, number>> = { held: 0, confirmed: 1, in_progress: 2, pending_review: 3, completed: 3 };

export const onTimeline = (status: Status) => POSITION[status] !== undefined;

/** Vertical progress of a visit; the current step is emphasised, finished steps get a check. */
export function StatusTimeline({ status, notes = {} }: { status: Status; notes?: Partial<Record<(typeof STEPS)[number], string>> }) {
  const at = POSITION[status] ?? 0;
  const labels = STEPS.map((s, i) => (i === 3 && status === "pending_review" ? "En revisión" : i === 0 && status === "held" ? "Pago pendiente" : s));
  return (
    <View accessibilityLabel={`Estado: ${labels[at]}`}>
      {labels.map((label, i) => {
        const done = i < at || (i === at && status === "completed");
        const current = i === at && !done;
        const lastRow = i === labels.length - 1;
        return (
          <View key={label} className="flex-row gap-4">
            <View className="items-center">
              <View
                className={`h-7 w-7 items-center justify-center rounded-full ${done ? "bg-primary" : current ? "border-4 border-primary-soft bg-primary" : "border-2 border-border bg-surface-raised"}`}
              >
                {done ? <Icon name="check" size={14} color={color["on-primary"]} strokeWidth={3} /> : null}
              </View>
              {lastRow ? null : <View className={`w-0.5 flex-1 ${i < at ? "bg-primary" : "bg-border"}`} style={{ minHeight: 28 }} />}
            </View>
            <View className={`flex-1 gap-0.5 ${lastRow ? "" : "pb-5"}`}>
              <Text className={`text-md ${current || done ? "font-bold text-text" : "font-medium text-text-muted"}`}>{label}</Text>
              {notes[STEPS[i]!] && (current || done) ? <Text className="text-sm text-text-muted">{notes[STEPS[i]!]}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
