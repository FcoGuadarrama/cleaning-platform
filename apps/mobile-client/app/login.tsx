import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";
import { useSession } from "../src/session";
import { Button } from "../src/ui";

export const inputClass = "min-h-11 rounded-md border border-border bg-background px-3 text-md text-text";

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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background">
      <View className="gap-4 p-6">
        <Text accessibilityRole="header" className="text-2xl font-bold text-text">Bienvenida</Text>
        <TextInput accessibilityLabel="Correo electrónico" placeholder="Correo electrónico" autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="username" value={email} onChangeText={setEmail} className={inputClass} />
        <TextInput accessibilityLabel="Contraseña" placeholder="Contraseña" secureTextEntry autoComplete="password" textContentType="password" value={password} onChangeText={setPassword} className={inputClass} />
        {error ? <Text accessibilityRole="alert" className="text-md text-danger">{error}</Text> : null}
        <Button label="Entrar" onPress={submit} busy={busy} disabled={!email || !password} />
        <Link href="/register" className="py-3 text-center text-md text-primary">¿No tienes cuenta? Regístrate</Link>
      </View>
    </KeyboardAvoidingView>
  );
}
