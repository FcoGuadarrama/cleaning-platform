import { router } from "expo-router";
import { useRef, useState, type ComponentRef, type ComponentType } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarIllustration, PaymentIllustration, PeopleIllustration } from "../src/illustrations";
import { prefs } from "../src/prefs";
import { Button } from "../src/ui";

const SLIDES: { art: ComponentType<{ size?: number }>; title: string; text: string }[] = [
  { art: PeopleIllustration, title: "Tú eliges quién te visita", text: "Conoce a cada persona del equipo y reserva con quien prefieras." },
  { art: CalendarIllustration, title: "Reserva en minutos", text: "Elige servicio, día y hora. Atendemos de lunes a viernes." },
  { art: PaymentIllustration, title: "Paga desde la app", text: "Tu horario queda apartado mientras completas el pago." },
];

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  async function leave(to: "/login" | "/register") {
    await prefs.set("welcome.seen", "1");
    router.replace(to);
  }

  function goTo(i: number) {
    scroller.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  }

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View className="h-14 flex-row items-center justify-end px-5">
        {!last ? (
          <Pressable accessibilityRole="button" onPress={() => leave("/login")} className="min-h-11 justify-center px-2">
            <Text className="text-md font-semibold text-text-muted">Omitir</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => width && setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        className="flex-1"
      >
        {SLIDES.map(({ art: Art, title, text }) => (
          <View key={title} style={{ width, height }} className="items-center justify-center gap-8 px-8">
            <Art size={240} />
            <View className="items-center gap-3">
              <Text accessibilityRole="header" className="text-center text-2xl font-extrabold tracking-[-0.8px] text-text">{title}</Text>
              <Text className="text-center text-md text-text-muted">{text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View className="gap-6 px-6">
        <View className="flex-row justify-center gap-2" accessibilityLabel={`Paso ${page + 1} de ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <View key={s.title} className={`h-2 rounded-full ${i === page ? "w-6 bg-primary" : "w-2 bg-border"}`} />
          ))}
        </View>
        {last ? (
          <View className="gap-3">
            <Button label="Crear cuenta" onPress={() => leave("/register")} />
            <Button label="Ya tengo cuenta" variant="soft" onPress={() => leave("/login")} />
          </View>
        ) : (
          <Button label="Siguiente" onPress={() => goTo(page + 1)} />
        )}
      </View>
    </View>
  );
}
