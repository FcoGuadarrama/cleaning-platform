import { router } from "expo-router";
import { View } from "react-native";
import { shortAddress, useAddresses } from "../../../src/addresses";
import { Icon } from "../../../src/icons";
import { FlowScreen } from "../../../src/screen";
import { Text } from "../../../src/text";
import { color } from "../../../src/theme";
import { Button, EmptyState, List, Notice, Row, SkeletonRows } from "../../../src/ui";

function openForm(id: number | "new") {
  router.push({ pathname: "/(customer)/addresses/[id]", params: { id: String(id) } });
}

/** "Principal" tag plus the navigation arrow (a custom trailing replaces Row's arrow). */
function Trailing({ isDefault }: { isDefault: boolean }) {
  return (
    <View className="flex-row items-center gap-3">
      {isDefault ? (
        <View className="rounded-full bg-primary-soft px-2.5 py-1">
          <Text className="text-xs font-semibold text-primary">Principal</Text>
        </View>
      ) : null}
      <Icon name="arrow" size={20} color={color.text} strokeWidth={1.6} />
    </View>
  );
}

export default function MyAddresses() {
  const addresses = useAddresses();
  const list = addresses.data ?? [];

  return (
    <FlowScreen
      title="Mis domicilios"
      fallback="/(customer)/(tabs)/account"
      footer={list.length ? <Button label="Agregar domicilio" icon="plus" variant="outline" onPress={() => openForm("new")} /> : undefined}
    >
      <Text className="text-md text-text-muted">Elige uno al reservar. El principal aparece seleccionado primero.</Text>
      {addresses.loading && !addresses.data ? <SkeletonRows count={2} /> : null}
      {addresses.error ? (
        <View className="gap-3">
          <Notice tone="danger" text={addresses.error} />
          <Button label="Reintentar" variant="outline" onPress={addresses.refresh} />
        </View>
      ) : null}
      {addresses.data && !list.length ? (
        <EmptyState
          icon="home"
          title="Aún no tienes domicilios"
          text="Guarda tu casa u oficina para reservar más rápido."
          action={<Button label="Agregar domicilio" icon="plus" onPress={() => openForm("new")} />}
        />
      ) : null}
      {list.length ? (
        <List>
          {list.map((a) => (
            <Row
              key={a.id}
              icon={a.is_default ? "home" : "pin"}
              title={a.label}
              subtitle={shortAddress(a)}
              trailing={<Trailing isDefault={a.is_default} />}
              accessibilityLabel={`${a.label}${a.is_default ? ", principal" : ""}. Editar`}
              onPress={() => openForm(a.id)}
            />
          ))}
        </List>
      ) : null}
    </FlowScreen>
  );
}
