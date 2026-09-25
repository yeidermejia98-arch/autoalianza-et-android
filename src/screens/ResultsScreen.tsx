import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ExamResult } from "../types";
import { ThemeColors } from "../theme";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";
import ReviewQuestionCard from "../components/ReviewQuestionCard";

interface Props {
  result: ExamResult;
  onRetry: () => void;
  onBackHome: () => void;
}

export default function ResultsScreen({ result, onRetry, onBackHome }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const percent = Math.round((result.correct / result.total) * 100);
  const wrongAnswers = result.wrongAnswers ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toggleRow}>
        <ThemeToggle />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.emoji}>{result.passed ? "🎉" : "📚"}</Text>
        <Text style={styles.title}>{result.passed ? "¡Aprobaste!" : "No aprobaste"}</Text>
        <Text style={styles.score}>
          {result.correct} de {result.total} correctas ({percent}%)
        </Text>
        <Text style={styles.threshold}>
          Puntaje mínimo para aprobar: {Math.round(result.passThreshold * 100)}%
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={onRetry}>
          <Text style={styles.primaryButtonText}>Intentar de nuevo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onBackHome}>
          <Text style={styles.secondaryButtonText}>Volver al inicio</Text>
        </TouchableOpacity>

        {wrongAnswers.length > 0 ? (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewTitle}>
              Repasa lo que te faltó ({wrongAnswers.length} pregunta{wrongAnswers.length === 1 ? "" : "s"})
            </Text>
            {wrongAnswers.map((wa, i) => (
              <ReviewQuestionCard key={wa.questionId + i} index={i + 1} wrongAnswer={wa} />
            ))}
          </View>
        ) : (
          <Text style={styles.perfectText}>🎯 ¡Contestaste todas las preguntas correctamente!</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    toggleRow: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 8 },
    scroll: { padding: 24, paddingTop: 8 },
    emoji: { fontSize: 56, textAlign: "center", marginBottom: 8 },
    title: { fontSize: 24, fontWeight: "700", textAlign: "center", color: colors.text },
    score: { fontSize: 18, textAlign: "center", marginTop: 8, color: colors.text },
    threshold: { fontSize: 13, textAlign: "center", marginTop: 4, color: colors.textMuted, marginBottom: 32 },
    primaryButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 16, marginBottom: 12 },
    primaryButtonText: { color: colors.buttonText, textAlign: "center", fontSize: 16, fontWeight: "600" },
    secondaryButton: { paddingVertical: 12, marginBottom: 8 },
    secondaryButtonText: { color: colors.primary, textAlign: "center", fontSize: 15 },
    reviewSection: { marginTop: 24 },
    reviewTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 12 },
    perfectText: { textAlign: "center", color: colors.success, marginTop: 24, fontSize: 15 },
  });
}
