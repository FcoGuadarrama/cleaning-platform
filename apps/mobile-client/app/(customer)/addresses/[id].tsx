import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { type Address, useAddresses } from "../../../src/addresses";
import { api, errorMessage } from "../../../src/api";
import { Icon } from "../../../src/icons";
import { FlowScreen } from "../../../src/screen";
import { Text } from "../../../src/text";
import { color } from "../../../src/theme";
import { Button, Field, InfoNote, Notice, SkeletonRows } from "../../../src/ui";

type Form = Pick<Address, "label" | "street" | "interior" | "neighbourhood" | "postal_code" | "municipality" | "state" | "directions">;

const EMPTY: Form = { label: "", street: "", interior: "", neighbourhood: "", postal_code: "", municipality: "", state: "", directions: "" };
const REQUIRED: (keyof Form)[] = ["label", "street", "neighbourhood", "postal_code", "municipality", "state"];

function pick(a: Address): Form {
  const { label, street, interior, neighbourhood, postal_code, municipality, state, directions } = a;
  return { label, street, interior, neighbourhood, postal_code, municipality, state, directions };
}

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace("/(customer)/addresses");
}

function DeleteAddress({ id, onError }: { id: number; onError: (message: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const r = await api.DELETE("/addresses/{address_id}", { params: { path: { address_id: id } } });
    setBusy(false);
    if (r.error) onError(errorMessage(r.error));
    else leave();
  }

  if (!confirming)
    return (
      <Pressable accessibilityRole="button" onPress={() => setConfirming(true)} className="min-h-11 flex-row items-center gap-2 self-start active:opacity-60">
        <Icon name="trash" size={20} color={color.danger} strokeWidth={1.7} />
        <Text className="text-md font-semibold text-danger">Eliminar domicilio</Text>
      </Pressable>
    );
  return (
    <View className="gap-3 rounded-lg bg-danger-soft p-4">
      <Text className="text-md font-semibold text-text">¿Eliminar este domicilio?</Text>
      <Text className="text-sm text-text">Tus visitas ya reservadas conservan la dirección con la que se agendaron.</Text>
      <View className="flex-row gap-3">
        <Button label="Cancelar" variant="outline" compact className="flex-1" onPress={() => setConfirming(false)} />
        <Button label="Eliminar" variant="danger" compact busy={busy} className="flex-1" onPress={remove} />
      </View>
    </View>
  );
}

export default function AddressForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const addresses = useAddresses();
  const existing = isNew ? undefined : addresses.data?.find((a) => a.id === Number(id));
  const [form, setForm] = useState<Form>(EMPTY);
  const [loaded, setLoaded] = useState(isNew);
  const [makeDefault, setMakeDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing && !loaded) {
      setForm(pick(existing));
      setLoaded(true);
    }
  }, [existing, loaded]);

  const set = (key: keyof Form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const zipOk = /^\d{5}$/.test(form.postal_code.trim());
  const valid = REQUIRED.every((k) => form[k].trim().length > 0) && zipOk;
  const isFirst = isNew && addresses.data?.length === 0;

  async function save() {
    setBusy(true);
    setError(null);
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as Form;
    const r = isNew
      ? await api.POST("/addresses", { body: { ...body, is_default: makeDefault } })
      : await api.PATCH("/addresses/{address_id}", {
          params: { path: { address_id: Number(id) } },
          body: makeDefault ? { ...body, is_default: true } : body,
        });
    setBusy(false);
    if (r.error) setError(errorMessage(r.error));
    else leave();
  }

  const notFound = !isNew && addresses.data && !existing;

  return (
    <FlowScreen
      title={isNew ? "Nuevo domicilio" : "Editar domicilio"}
      fallback="/(customer)/addresses"
      footer={loaded ? <Button label="Guardar" busy={busy} disabled={!valid} onPress={save} /> : undefined}
    >
      {!loaded && !notFound ? <SkeletonRows count={4} /> : null}
      {notFound ? <Notice tone="danger" text="Este domicilio ya no existe." /> : null}
      {addresses.error ? <Notice tone="danger" text={addresses.error} /> : null}
      {loaded ? (
        <>
          <Field label="Nombre" icon="home" placeholder="Casa, Oficina, Depto. de mamá" maxLength={40} value={form.label} onChangeText={set("label")} />
          <Field label="Calle y número" placeholder="Colima 214" maxLength={200} autoComplete="street-address" textContentType="streetAddressLine1" value={form.street} onChangeText={set("street")} />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="Interior (opcional)" placeholder="3B" maxLength={60} textContentType="streetAddressLine2" value={form.interior} onChangeText={set("interior")} />
            </View>
            <View className="flex-1">
              <Field label="Código postal" placeholder="06700" maxLength={5} keyboardType="number-pad" autoComplete="postal-code" textContentType="postalCode" value={form.postal_code} onChangeText={(v) => set("postal_code")(v.replace(/\D/g, ""))} />
            </View>
          </View>
          {form.postal_code.length > 0 && !zipOk ? <Text className="-mt-3 text-sm text-danger">El código postal tiene 5 dígitos.</Text> : null}
          <Field label="Colonia" placeholder="Roma Norte" maxLength={120} value={form.neighbourhood} onChangeText={set("neighbourhood")} />
          <Field label="Municipio o alcaldía" placeholder="Cuauhtémoc" maxLength={120} textContentType="addressCity" value={form.municipality} onChangeText={set("municipality")} />
          <Field label="Estado" placeholder="Ciudad de México" maxLength={80} textContentType="addressState" value={form.state} onChangeText={set("state")} />
          <Field label="Referencias (opcional)" placeholder="Entre qué calles, color del portón…" maxLength={300} multiline value={form.directions} onChangeText={set("directions")} />

          {existing?.is_default || isFirst ? (
            <InfoNote text={isFirst ? "Será tu domicilio principal." : "Este es tu domicilio principal."} />
          ) : (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: makeDefault }}
              onPress={() => setMakeDefault((v) => !v)}
              className="min-h-11 flex-row items-center gap-3 active:opacity-60"
            >
              <Icon name={makeDefault ? "check" : "square"} size={24} color={makeDefault ? color.primary : color.border} strokeWidth={makeDefault ? 2.4 : 1.8} />
              <Text className="flex-1 text-md text-text">Usar como domicilio principal</Text>
            </Pressable>
          )}

          {error ? <Notice tone="danger" text={error} /> : null}
          {existing ? <DeleteAddress id={existing.id} onError={setError} /> : null}
        </>
      ) : null}
    </FlowScreen>
  );
}
