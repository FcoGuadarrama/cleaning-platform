import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, TextInput } from "react-native";
import { useSession } from "../src/session";
import { Button } from "../src/ui";
import { inputClass } from "./login";

export default function Register() {
  const { register } = useSession();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });

  async function submit() {
    setBusy(true);
    const e = await register(form.email, form.password, form.name);
    setBusy(false);
    setError(e);
    if (!e) router.replace("/");
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-6">
      <TextInput accessibilityLabel="Nombre completo" placeholder="Nombre completo" autoComplete="name" value={form.name} onChangeText={set("name")} className={inputClass} />
      <TextInput accessibilityLabel="Correo electrónico" placeholder="Correo electrónico" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={set("email")} className={inputClass} />
      <TextInput accessibilityLabel="Contraseña, mínimo 10 caracteres" placeholder="Contraseña (mín. 10 caracteres)" secureTextEntry textContentType="newPassword" value={form.password} onChangeText={set("password")} className={inputClass} />
      {error ? <Text accessibilityRole="alert" className="text-md text-danger">{error}</Text> : null}
      <Button label="Crear cuenta" onPress={submit} busy={busy} disabled={!form.name || !form.email || form.password.length < 10} />
    </ScrollView>
  );
}
