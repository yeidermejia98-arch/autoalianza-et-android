import React, { useMemo } from "react";
import { ActivityIndicator, SectionList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeColors } from "../theme";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";
import { useHorarios, useContentSync } from "../context/ContentContext";
import { HorarioClase } from "../lib/content";

interface Props {
  onBack: () => void;
}

interface Section {
  key: string;
  label: string;
  data: HorarioClase[];
}

const TIPO_INFO: Record<HorarioClase["tipo"], { label: string; colorKey: "success" | "gaugeAmber" }> = {
  teoria: { label: "TEORÍA", colorKey: "success" },
  taller: { label: "TALLER", colorKey: "gaugeAmber" },
};

// "2026-09-22" -> "Martes 22 de septiembre". Se arma la fecha con hora fija
// de mediodía UTC para que ningún huso horario la corra un día para atrás o
// adelante (el problema clásico de "new Date('YYYY-MM-DD')").
function formatDayLabel(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  const raw = d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function HorariosScreen({ onBack }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const horarios = useHorarios();
  const { refreshing } = useContentSync();

  const sections = useMemo<Section[]>(() => {
    const byFecha = new Map<string, HorarioClase[]>();
    horarios.forEach((h) => {
      const list = byFecha.get(h.fecha) || [];
      list.push(h);
      byFecha.set(h.fecha, list);
    });
    return Array.from(byFecha.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, data]) => ({ key: fecha, label: formatDayLabel(fecha), data }));
  }, [horarios]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Horarios de Clases
        </Text>
        <ThemeToggle />
      </View>

      <View style={styles.noteBox}>
        <View style={styles.noteBar} />
        <Text style={styles.noteText}>
          Todas las clases de teoría son abiertas: puedes asistir a cualquier horario de la semana, sin
          importar tu categoría de licencia.
        </Text>
      </View>

      {refreshing && horarios.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <SectionList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.label}</Text>
          )}
          renderItem={({ item }) => {
            const info = TIPO_INFO[item.tipo];
            const badgeColor = colors[info.colorKey];
            return (
              <View style={styles.card}>
                <View style={[styles.cardBar, { backgroundColor: badgeColor }]} />
                <View style={styles.cardBody}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTime}>
                      {item.horaInicio} – {item.horaFin}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                      <Text style={styles.badgeText}>{info.label}</Text>
                    </View>
                  </View>
                  {item.instructor || item.lugar ? (
                    <Text style={styles.cardSubtitle}>
                      {[item.instructor ? `Instructor: ${item.instructor}` : null, item.lugar]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Todavía no hay horarios publicados para los próximos días. Vuelve a intentarlo más tarde.
            </Text>
          }
        />
      )}
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

    noteBox: {
      flexDirection: "row",
      gap: 10,
      backgroundColor: colors.selectedBg,
      borderRadius: 10,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 12,
      overflow: "hidden",
    },
    noteBar: { width: 3, borderRadius: 2, backgroundColor: colors.primary },
    noteText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.text },

    list: { flex: 1, marginTop: 8 },
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
    emptyText: { textAlign: "center", color: colors.textMuted, marginTop: 24, paddingHorizontal: 24 },

    sectionHeader: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.3,
      color: colors.primary,
      textTransform: "uppercase",
      backgroundColor: colors.background,
      paddingTop: 14,
      paddingBottom: 8,
    },

    card: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      marginBottom: 10,
      overflow: "hidden",
    },
    cardBar: { width: 4 },
    cardBody: { flex: 1, padding: 12 },
    cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    cardTime: { fontSize: 15, fontWeight: "700", color: colors.text },
    badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
    badgeText: { color: colors.buttonText, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.3 },
    cardSubtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 4 },
  });
}
