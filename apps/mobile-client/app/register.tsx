import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { AuthLayout } from "../src/AuthLayout";
import { useSession } from "../src/session";
import { Button, Field, Notice } from "../src/ui";

const MIN_PASSWORD = 10;

export default function Register() {
  const { register } = useSession();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });
  const shortPassword = form.password.length > 0 && form.password.length < MIN_PASSWORD;

  async function submit() {
    setBusy(true);
    const e = await register(form.email, form.password, form.name);
    setBusy(false);
    setError(e);
    if (!e) router.replace("/");
  }

  return (
    <AuthLayout back title="Crea tu cuenta" subtitle="Elige a tu persona de limpieza, reserva y paga desde la app.">
      <Field label="Nombre completo" icon="person" placeholder="Nombre y apellido" autoComplete="name" textContentType="name" value={form.name} onChangeText={set("name")} />
      <Field label="Correo electrónico" icon="mail" placeholder="tucorreo@ejemplo.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" value={form.email} onChangeText={set("email")} />
      <View className="gap-2">
        <Field label="Contraseña" icon="shield" placeholder={`Mínimo ${MIN_PASSWORD} caracteres`} secureTextEntry textContentType="newPassword" autoComplete="new-password" value={form.password} onChangeText={set("password")} />
        <Text className={`px-1 text-xs font-medium ${shortPassword ? "text-warning" : "text-text-muted"}`}>
          {shortPassword ? `Faltan ${MIN_PASSWORD - form.password.length} caracteres.` : `Usa al menos ${MIN_PASSWORD} caracteres.`}
        </Text>
      </View>
      {error ? <Notice tone="danger" text={error} /> : null}
      <Button label="Crear cuenta" onPress={submit} busy={busy} disabled={!form.name || !form.email || form.password.length < MIN_PASSWORD} />
    </AuthLayout>
  );
}
