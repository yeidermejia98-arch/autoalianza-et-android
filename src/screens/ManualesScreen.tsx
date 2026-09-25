import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeColors } from "../theme";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";
import { ManualLink } from "./HomeScreen";

interface Props {
  manuals: ManualLink[];
  onBack: () => void;
  onOpenLink: (url: string) => void;
}

export default function ManualesScreen({ manuals, onBack, onOpenLink }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Manuales
        </Text>
        <ThemeToggle />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {manuals.map((manual) => (
          <TouchableOpacity
            key={manual.url}
            style={styles.card}
            onPress={() => onOpenLink(manual.url)}
          >
            <Text style={styles.cardText}>📘 {manual.title}</Text>
          </TouchableOpacity>
        ))}
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
    headerTitle: { flex: 1, fontSize: 15, fontWeight: "700", textAlign: "center", color: colors.text },
    scroll: { padding: 16 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
      marginBottom: 10,
    },
    cardText: { fontSize: 15, color: colors.text },
  });
}
