import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../src/icons";
import { useSession } from "../src/session";
import { color } from "../src/theme";
import { Button, Field, Notice } from "../src/ui";

function BrandMark() {
  return (
    <View className="h-14 w-14 items-center justify-center rounded-xl bg-primary">
      <Icon name="home" size={30} color={color["on-primary"]} strokeWidth={2} />
    </View>
  );
}

export default function Login() {
  const { login } = useSession();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const e = await login(email, password);
    setBusy(false);
    setError(e);
    if (!e) router.replace("/");
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-surface">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="flex-grow justify-center gap-8 px-6"
        contentContainerStyle={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }}
      >
        <View className="gap-4">
          <BrandMark />
          <View className="gap-2">
            <Text accessibilityRole="header" className="text-2xl font-bold tracking-[-0.6px] text-text">Limpieza</Text>
            <Text className="text-md text-text-muted">Reserva la limpieza de tu casa o revisa tus servicios del día.</Text>
          </View>
        </View>

        <View className="gap-4">
          <Field label="Correo electrónico" placeholder="tucorreo@ejemplo.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="username" value={email} onChangeText={setEmail} />
          <Field label="Contraseña" placeholder="Tu contraseña" secureTextEntry autoComplete="password" textContentType="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} enterKeyHint="go" />
          {error ? <Notice tone="danger" text={error} /> : null}
          <Button label="Entrar" onPress={submit} busy={busy} disabled={!email || !password} />
        </View>

        <View className="flex-row items-center justify-center gap-1">
          <Text className="text-md text-text-muted">¿Aún no tienes cuenta?</Text>
          <Link href="/register" className="py-3 text-md font-semibold text-primary">Crear cuenta</Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
