import { Link, router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { AuthLayout } from "../src/AuthLayout";
import { useSession } from "../src/session";
import { Button, Field, Notice } from "../src/ui";

export default function Login() {
  const { login } = useSession();
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
    <AuthLayout title="Inicia sesión" subtitle="Reserva la limpieza de tu casa o revisa tus servicios del día.">
      <Field label="Correo electrónico" icon="mail" placeholder="tucorreo@ejemplo.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="username" value={email} onChangeText={setEmail} />
      <Field label="Contraseña" icon="shield" placeholder="Tu contraseña" secureTextEntry autoComplete="password" textContentType="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} enterKeyHint="go" />
      {error ? <Notice tone="danger" text={error} /> : null}
      <Button label="Entrar" onPress={submit} busy={busy} disabled={!email || !password} />
      <View className="flex-row items-center justify-center gap-1">
        <Text className="text-md text-text-muted">¿Aún no tienes cuenta?</Text>
        <Link href="/register" className="py-3 text-md font-bold text-primary">Crear cuenta</Link>
      </View>
    </AuthLayout>
  );
}
