import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, View, ActivityIndicator, StyleSheet, Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import HomeScreen, { ManualLink } from "./src/screens/HomeScreen";
import PracticeScreen from "./src/screens/PracticeScreen";
import ExamScreen from "./src/screens/ExamScreen";
import ResultsScreen from "./src/screens/ResultsScreen";
import PaywallScreen from "./src/screens/PaywallScreen";
import CodigoTransitoScreen from "./src/screens/CodigoTransitoScreen";
import SenalesTransitoScreen from "./src/screens/SenalesTransitoScreen";
import ManualesScreen from "./src/screens/ManualesScreen";
import HorariosScreen from "./src/screens/HorariosScreen";

import { Question, ExamResult } from "./src/types";
import { hasFullAccess as checkFullAccess, initPurchases, getFullAccessPriceLabel } from "./src/lib/purchases";
import { addExamResult } from "./src/lib/storage";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { ContentProvider, useQuestionBank } from "./src/context/ContentContext";

// El banco de preguntas ya NO se importa directamente aquí: ahora lo entrega
// useQuestionBank() (ver src/context/ContentContext.tsx), que arranca con el
// mismo banco empacado en el build (src/data/questions.json) y lo actualiza
// solo si logra sincronizar con Supabase — así la app nunca deja de
// funcionar, con o sin internet.

// Configuración del examen simulado
const EXAM_LENGTH = 20; // nº de preguntas por examen (se ajusta solo si el banco tiene menos)
const PASS_THRESHOLD = 0.8; // 80% para aprobar, igual que el examen real
const SECONDS_PER_QUESTION = 45;

// Enlaces oficiales (ANSV / Min. Transporte) a los manuales que se muestran
// en el menú de "Manuales oficiales" de la pantalla de inicio. Abrimos estos
// enlaces en el navegador del celular en lugar de incluir los PDF dentro de
// la app: los manuales tienen aviso de derechos de autor del Ministerio de
// Transporte, así que en vez de redistribuir una copia dentro de la app (lo
// cual sí requeriría permiso explícito de la entidad), simplemente
// enlazamos a la fuente oficial. Para agregar un manual nuevo más adelante,
// solo hay que sumar un objeto más a este arreglo.
const OFFICIAL_MANUALS: ManualLink[] = [
  {
    title: "Manual de Referencia para la Conducción",
    url: "https://www.ansv.gov.co/sites/default/files/2026/Escuela_Virtual/Manual_de_referencia_conduccion_de_vehiculos.pdf",
  },
  {
    title: "Manual de Señalización Vial 2024",
    url: "https://ansv.gov.co/sites/default/files/2025/Publicaciones/Manual_de_Senalizacion_Vial/Manual_de_Senalizacion_Vial.pdf",
  },
  {
    title: "Código Nacional de Tránsito Terrestre (Ley 769 de 2002)",
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=5557",
  },
];

type Screen = "home" | "practice" | "exam" | "results" | "paywall" | "codigo" | "senales" | "manuales" | "horarios";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ContentProvider>
          <AppContent />
        </ContentProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { colors } = useTheme();
  const bank = useQuestionBank();
  const [screen, setScreen] = useState<Screen>("home");
  // "screen" es la pantalla que se PIDIÓ mostrar; "displayedScreen" es la que
  // realmente está montada. Antes el cambio de pantalla era un corte seco
  // (switch directo sobre "screen"), lo que dejaba ver un fotograma con las
  // dos pantallas mezcladas cuando la que entra tarda algo en dibujarse. Con
  // este cross-fade, primero se atenúa la pantalla actual, LUEGO (ya
  // invisible) se monta la nueva, y por último aparece con un fundo suave —
  // así cualquier costo de montaje queda oculto detrás de la opacidad 0 en
  // vez de verse como un salto.
  const [displayedScreen, setDisplayedScreen] = useState<Screen>("home");
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [loading, setLoading] = useState(true);
  const [fullAccess, setFullAccess] = useState(false);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [lastResult, setLastResult] = useState<ExamResult | null>(null);
  // Precio real de la compra dentro de la app, obtenido de RevenueCat
  // (refleja lo configurado en App Store Connect / Play Console). El valor
  // inicial es solo un respaldo por si RevenueCat tarda en responder o falla.
  const [priceLabel, setPriceLabel] = useState("$29.900 COP");

  useEffect(() => {
    if (screen === displayedScreen) return;
    // Antes esto hacía "fade-out (120ms) -> esperar aviso de animación
    // terminada o un timer de seguridad de hasta 260ms -> recién ahí montar
    // la pantalla nueva -> fade-in (180ms)". Ese hueco intermedio, en el que
    // la pantalla vieja ya es invisible pero la nueva todavía no se monta,
    // es justo lo que se veía como "parpadeo negro" (y sumaba hasta ~440ms
    // de demora en cada cambio de pantalla).
    //
    // Ahora se monta la pantalla nueva de inmediato y solo se le hace un
    // fade-in corto encima del fondo del tema (ver el <View> del return más
    // abajo), así nunca hay un instante sin nada dibujado.
    setDisplayedScreen(screen);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [screen, displayedScreen, fadeAnim]);

  useEffect(() => {
    (async () => {
      try {
        await initPurchases();
        setFullAccess(await checkFullAccess());
        const label = await getFullAccessPriceLabel();
        if (label) setPriceLabel(label);
      } catch (err) {
        // RevenueCat no funciona dentro de Expo Go (solo en un build real),
        // así que aquí es normal que falle mientras pruebas en Expo Go. No
        // debe dejar la app pegada en la pantalla de carga.
        console.warn("No se pudo inicializar RevenueCat (esperado en Expo Go).", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const freeQuestions = useMemo(
    () => bank.questions.filter((q) => q.isFree),
    [bank]
  );
  const practiceQuestions = fullAccess ? bank.questions : freeQuestions;

  function startPractice() {
    setScreen("practice");
  }

  function startExam() {
    const pool = fullAccess ? bank.questions : freeQuestions;
    if (pool.length === 0) return;
    const count = Math.min(EXAM_LENGTH, pool.length);
    setExamQuestions(shuffle(pool).slice(0, count));
    setScreen("exam");
  }

  async function handleExamFinish(result: ExamResult) {
    setLastResult(result);
    await addExamResult(result);
    setScreen("results");
  }

  async function openLink(url: string) {
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.warn("No se pudo abrir el enlace", err);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  function renderScreen() {
    switch (displayedScreen) {
      case "practice":
        return (
          <PracticeScreen
            questions={practiceQuestions}
            allQuestionsCount={bank.questions.length}
            hasFullAccess={fullAccess}
            onBack={() => setScreen("home")}
            onLockedQuestionTap={() => setScreen("paywall")}
          />
        );

      case "exam":
        return (
          <ExamScreen
            questions={examQuestions}
            passThreshold={PASS_THRESHOLD}
            secondsPerQuestion={SECONDS_PER_QUESTION}
            onFinish={handleExamFinish}
            onExit={() => setScreen("home")}
          />
        );

      case "results":
        return lastResult ? (
          <ResultsScreen
            result={lastResult}
            onRetry={startExam}
            onBackHome={() => setScreen("home")}
          />
        ) : null;

      case "paywall":
        return (
          <PaywallScreen
            // Precio real obtenido de RevenueCat (App Store Connect / Play
            // Console). Si no se pudo cargar, se usa el valor de respaldo
            // definido en el useState de arriba.
            priceLabel={priceLabel}
            onPurchased={() => {
              setFullAccess(true);
              setScreen("home");
            }}
            onClose={() => setScreen("home")}
          />
        );

      case "codigo":
        return <CodigoTransitoScreen onBack={() => setScreen("home")} onOpenLink={openLink} />;

      case "senales":
        return <SenalesTransitoScreen onBack={() => setScreen("home")} onOpenLink={openLink} />;

      case "manuales":
        return (
          <ManualesScreen
            manuals={OFFICIAL_MANUALS}
            onBack={() => setScreen("home")}
            onOpenLink={openLink}
          />
        );

      case "horarios":
        return <HorariosScreen onBack={() => setScreen("home")} />;

      case "home":
      default:
        return (
          <HomeScreen
            hasFullAccess={fullAccess}
            examLabel={bank.examCategoryLabel}
            onStartPractice={startPractice}
            onStartExam={startExam}
            onOpenPaywall={() => setScreen("paywall")}
            onOpenManuales={() => setScreen("manuales")}
            onOpenCodigo={() => setScreen("codigo")}
            onOpenSenales={() => setScreen("senales")}
            onOpenHorarios={() => setScreen("horarios")}
          />
        );
    }
  }

  return (
    // Fondo sólido del color del tema detrás de la animación: si el fondo
    // de aquí quedara transparente, cualquier micro-instante en que
    // fadeAnim esté en 0 dejaría ver el negro por defecto de la ventana
    // nativa (eso era el "parpadeo negro"). Con este fondo, ese mismo
    // instante se ve como el color de fondo normal de la app, no como negro.
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.fill, { opacity: fadeAnim }]}>
        {renderScreen()}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  fill: { flex: 1 },
});
