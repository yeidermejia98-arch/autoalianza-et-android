import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Question } from "../types";
import { ThemeColors } from "../theme";
import { useTheme } from "../context/ThemeContext";

interface Props {
  question: Question;
  onAnswer: (selectedIndex: number, isCorrect: boolean) => void;
  showExplanation?: boolean; // modo práctica: true, modo examen: false
}

export default function QuestionCard({ question, onAnswer, showExplanation = true }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selected, setSelected] = useState<number | null>(null);

  const handlePress = (index: number) => {
    if (selected !== null) return; // ya respondió, evitar doble tap
    setSelected(index);
    onAnswer(index, index === question.correctIndex);
  };

  return (
    <View style={styles.card}>
      {question.imageUrl ? (
        <Image source={{ uri: question.imageUrl }} style={styles.image} resizeMode="contain" />
      ) : null}
      <Text style={styles.question}>{question.question}</Text>
      {question.options.map((option, index) => {
        const isSelected = selected === index;
        const isCorrectOption = index === question.correctIndex;
        const showFeedback = selected !== null && showExplanation;

        let optionStyle = styles.option;
        if (showFeedback && isCorrectOption) optionStyle = { ...styles.option, ...styles.correct };
        else if (showFeedback && isSelected && !isCorrectOption)
          optionStyle = { ...styles.option, ...styles.incorrect };
        else if (isSelected) optionStyle = { ...styles.option, ...styles.selected };

        return (
          <TouchableOpacity key={index} style={optionStyle} onPress={() => handlePress(index)}>
            <Text style={styles.optionText}>{option}</Text>
          </TouchableOpacity>
        );
      })}
      {selected !== null && showExplanation && question.explanation ? (
        <Text style={styles.explanation}>{question.explanation}</Text>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginVertical: 8,
      shadowColor: "#000",
      shadowOpacity: colors.mode === "dark" ? 0.3 : 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    image: { width: "100%", height: 160, marginBottom: 12 },
    question: { fontSize: 17, fontWeight: "600", marginBottom: 12, color: colors.text },
    option: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    selected: { borderColor: colors.primary, backgroundColor: colors.selectedBg },
    correct: { borderColor: colors.success, backgroundColor: colors.successBg },
    incorrect: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
    optionText: { fontSize: 15, color: colors.text },
    explanation: { marginTop: 8, fontSize: 14, color: colors.textMuted, fontStyle: "italic" },
  });
}
