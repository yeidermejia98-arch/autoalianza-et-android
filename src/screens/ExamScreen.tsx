import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QuestionCard from "../components/QuestionCard";
import { Question, ExamResult, WrongAnswer } from "../types";
import { ThemeColors } from "../theme";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";
import { useScreenCaptureProtection } from "../lib/screenCapture";

interface Props {
  questions: Question[]; // el set completo de preguntas para el examen (ya barajadas)
  passThreshold: number; // ej. 0.8
  secondsPerQuestion: number; // ej. 60
  onFinish: (result: ExamResult) => void;
  onExit: () => void;
}

export default function ExamScreen({
  questions,
  passThreshold,
  secondsPerQuestion,
  onFinish,
  onExit,
}: Props) {
  useScreenCaptureProtection();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const totalSeconds = questions.length * secondsPerQuestion;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const finishedRef = useRef(false);
  // Guardamos aquí (en una ref, no en estado) cada pregunta fallada a medida
  // que el usuario responde, para armar el repaso al final del examen. Usamos
  // una ref porque `finish()` puede dispararse desde el temporizador y
  // necesitamos el valor más reciente sin depender de un re-render.
  const wrongAnswersRef = useRef<WrongAnswer[]>([]);
  // Bug encontrado: el intervalo de abajo se crea UNA sola vez (deps: []), así
  // que si se agotaba el tiempo sin que el usuario respondiera la última
  // pregunta, `finish(correctCount)` usaba el valor de `correctCount` de
  // cuando se montó la pantalla (0), no el real — el resultado final quedaba
  // con 0 aciertos aunque el usuario hubiera respondido bien varias. Esta ref
  // se mantiene siempre al día y es lo que ahora usa el temporizador.
  const correctCountRef = useRef(0);
  useEffect(() => {
    correctCountRef.current = correctCount;
  }, [correctCount]);

  // El intervalo SOLO cuenta segundos — ya no llama a `finish()` desde dentro
  // del actualizador de `setSecondsLeft`. Llamar a `finish()` ahí disparaba
  // `setState` del componente PADRE (App.tsx cambia de pantalla) desde dentro
  // de la función que React usa para calcular el siguiente valor de
  // `secondsLeft`, algo que React documenta como no seguro: esa función debe
  // ser pura, sin efectos secundarios ni otros cambios de estado adentro.
  // Es la sospecha principal del congelamiento reportado ("se queda en negro
  // y no responde") justo al agotarse el tiempo del examen.
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Ahora "se acabó el tiempo" se maneja en un efecto aparte, disparado por
  // el cambio de `secondsLeft` a 0 — un lugar seguro para llamar a `finish()`
  // (y por lo tanto a los cambios de pantalla que dispara en App.tsx).
  useEffect(() => {
    if (secondsLeft === 0 && !finishedRef.current) {
      finish(correctCountRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  function finish(finalCorrect: number) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const result: ExamResult = {
      date: new Date().toISOString(),
      total: questions.length,
      correct: finalCorrect,
      passed: finalCorrect / questions.length >= passThreshold,
      passThreshold,
      wrongAnswers: wrongAnswersRef.current,
    };
    onFinish(result);
  }

  function handleAnswer(question: Question, selectedIndex: number, isCorrect: boolean) {
    const newCorrect = correctCount + (isCorrect ? 1 : 0);
    setCorrectCount(newCorrect);

    if (!isCorrect) {
      wrongAnswersRef.current.push({
        questionId: question.id,
        question: question.question,
        options: question.options,
        correctIndex: question.correctIndex,
        selectedIndex,
        explanation: question.explanation,
        source: question.source,
      });
    }

    setTimeout(() => {
      if (index + 1 >= questions.length) {
        finish(newCorrect);
      } else {
        setIndex((i) => i + 1);
      }
    }, 400);
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const currentQuestion = questions[index];

  // El color del cronómetro imita el degradado del velocímetro de la marca:
  // tranquilo (azul) -> alerta (naranja) -> crítico (rojo) a medida que se
  // agota el tiempo.
  const timeFraction = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const timerColor =
    timeFraction > 0.5 ? colors.primary : timeFraction > 0.2 ? colors.gaugeMid : colors.gaugeHigh;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            Alert.alert("Salir del examen", "¿Seguro que quieres salir? Perderás el progreso.", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Salir",
                style: "destructive",
                onPress: () => {
                  // Pequeña pausa (imperceptible) antes de desmontar esta
                  // pantalla. Al salir, ExamScreen se desmonta y apaga la
                  // protección contra capturas de pantalla, que es una
                  // operación nativa y no es instantánea. Como el cambio de
                  // pantalla ahora es inmediato (App.tsx ya no espera para
                  // montar la siguiente), sin esta pausa la pantalla de
                  // Inicio podía llegar a montarse justo en medio de esa
                  // limpieza nativa y del cierre de la alerta, dejando algo
                  // trabado encima que se veía negro y bloqueaba el tacto —
                  // justo el freeze reportado al salir antes de tiempo.
                  setTimeout(onExit, 80);
                },
              },
            ])
          }
        >
          <Text style={styles.exit}>✕ Salir</Text>
        </TouchableOpacity>
        <Text style={[styles.timer, { color: timerColor }]}>
          {minutes}:{seconds.toString().padStart(2, "0")}
        </Text>
        <Text style={styles.counter}>
          {index + 1}/{questions.length}
        </Text>
        <ThemeToggle />
      </View>

      {currentQuestion ? (
        <QuestionCard
          key={currentQuestion.id}
          question={currentQuestion}
          showExplanation={false}
          onAnswer={(selectedIndex, isCorrect) => handleAnswer(currentQuestion, selectedIndex, isCorrect)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16 },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    exit: { color: colors.danger, fontSize: 15 },
    timer: { fontSize: 16, fontWeight: "700" },
    counter: { fontSize: 14, color: colors.textMuted },
  });
}
