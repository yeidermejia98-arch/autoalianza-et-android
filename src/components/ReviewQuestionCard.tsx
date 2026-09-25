import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { WrongAnswer } from "../types";
import { ThemeColors } from "../theme";
import { useTheme } from "../context/ThemeContext";

interface Props {
  index: number; // número dentro del repaso (1, 2, 3...) solo para mostrar
  wrongAnswer: WrongAnswer;
}

// Tarjeta de solo lectura para el repaso de preguntas falladas en
// ResultsScreen: muestra la pregunta, marca en rojo la opción que el usuario
// eligió y en verde la opción correcta, más la explicación si existe.
export default function ReviewQuestionCard({ index, wrongAnswer }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Text style={styles.question}>
        {index}. {wrongAnswer.question}
      </Text>
      {wrongAnswer.options.map((option, optIndex) => {
        const isCorrectOption = optIndex === wrongAnswer.correctIndex;
        const isSelectedOption = optIndex === wrongAnswer.selectedIndex;

        let optionStyle = styles.option;
        if (isCorrectOption) optionStyle = { ...styles.option, ...styles.correct };
        else if (isSelectedOption) optionStyle = { ...styles.option, ...styles.incorrect };

        return (
          <View key={optIndex} style={optionStyle}>
            <Text style={styles.optionText}>
              {isCorrectOption ? "✓ " : isSelectedOption ? "✕ " : ""}
              {option}
            </Text>
          </View>
        );
      })}
      {wrongAnswer.explanation ? <Text style={styles.explanation}>{wrongAnswer.explanation}</Text> : null}
      {wrongAnswer.source ? <Text style={styles.source}>Fuente: {wrongAnswer.source}</Text> : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    question: { fontSize: 15, fontWeight: "600", marginBottom: 10, color: colors.text },
    option: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 10,
      marginBottom: 6,
    },
    correct: { borderColor: colors.success, backgroundColor: colors.successBg },
    incorrect: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
    optionText: { fontSize: 14, color: colors.text },
    explanation: { marginTop: 6, fontSize: 13, color: colors.textMuted, fontStyle: "italic" },
    source: { marginTop: 4, fontSize: 11, color: colors.textMuted },
  });
}
