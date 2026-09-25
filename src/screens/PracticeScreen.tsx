import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QuestionCard from "../components/QuestionCard";
import { Question } from "../types";
import { ThemeColors } from "../theme";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";
import { useScreenCaptureProtection } from "../lib/screenCapture";

interface Props {
  questions: Question[]; // ya filtradas según acceso (gratis o completas)
  onBack: () => void;
  onLockedQuestionTap: () => void; // se llama si el usuario intenta ver más de las gratis y no tiene acceso
  hasFullAccess: boolean;
  allQuestionsCount: number; // total real del banco, para mostrar "viste X de Y"
}

// Quita tildes/acentos y pasa a minúsculas, para que buscar "conduccion"
// también encuentre "conducción", sin importar mayúsculas/minúsculas.
function normalize(text: string): string {
  const decomposed = text.normalize("NFD");
  let result = "";
  for (let i = 0; i < decomposed.length; i++) {
    const code = decomposed.charCodeAt(i);
    // 0x0300–0x036F son los "acentos combinados" (tildes, diéresis, etc.)
    // que quedan sueltos después de descomponer el texto con NFD.
    if (code >= 0x0300 && code <= 0x036f) continue;
    result += decomposed[i];
  }
  return result.toLowerCase();
}

export default function PracticeScreen({
  questions,
  onBack,
  onLockedQuestionTap,
  hasFullAccess,
  allQuestionsCount,
}: Props) {
  useScreenCaptureProtection();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [search, setSearch] = useState("");

  const filteredQuestions = useMemo(() => {
    const query = normalize(search.trim());
    if (!query) return questions;
    return questions.filter((q) => {
      const haystack = normalize(
        [q.question, q.explanation, q.category, ...q.options].join(" ")
      );
      return haystack.includes(query);
    });
  }, [questions, search]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.progress} numberOfLines={1}>
          {answered}/{questions.length} respondidas · {correct} correctas
        </Text>
        <ThemeToggle />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar una pregunta..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 ? (
          <TouchableOpacity style={styles.clearButton} onPress={() => setSearch("")}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {search.trim().length > 0 ? (
        <Text style={styles.resultsCount}>
          {filteredQuestions.length === 0
            ? "No se encontraron preguntas con ese texto."
            : `${filteredQuestions.length} pregunta${filteredQuestions.length === 1 ? "" : "s"} encontrada${
                filteredQuestions.length === 1 ? "" : "s"
              }`}
        </Text>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll}>
        {filteredQuestions.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            showExplanation
            onAnswer={(_, isCorrect) => {
              setAnswered((a) => a + 1);
              if (isCorrect) setCorrect((c) => c + 1);
            }}
          />
        ))}

        {!hasFullAccess && questions.length < allQuestionsCount ? (
          <TouchableOpacity style={styles.lockedCard} onPress={onLockedQuestionTap}>
            <Text style={styles.lockedText}>
              🔒 Hay {allQuestionsCount - questions.length} preguntas más en el banco completo.
              Toca aquí para desbloquearlas.
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    back: { fontSize: 16, color: colors.primary },
    progress: { flex: 1, fontSize: 13, color: colors.textMuted, textAlign: "center", marginHorizontal: 8 },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
    },
    clearButton: { paddingLeft: 8, paddingVertical: 6 },
    clearButtonText: { color: colors.textMuted, fontSize: 16 },
    resultsCount: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: "center",
      marginTop: 8,
    },
    scroll: { padding: 16 },
    lockedCard: {
      backgroundColor: colors.warningBg,
      borderWidth: 1,
      borderColor: colors.warningBorder,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
    },
    lockedText: { color: colors.warningText, textAlign: "center", fontSize: 14 },
  });
}