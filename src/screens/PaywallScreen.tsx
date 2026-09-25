import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { purchaseFullAccess, restorePurchases } from "../lib/purchases";
import { ThemeColors } from "../theme";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";

interface Props {
  priceLabel: string; // ej. "$29.900 COP" — se define en Play Console / App Store Connect, no aquí
  onPurchased: () => void;
  onClose: () => void;
}

export default function PaywallScreen({ priceLabel, onPurchased, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);

  async function handleBuy() {
    setLoading(true);
    const result = await purchaseFullAccess();
    setLoading(false);
    if (result.success) {
      onPurchased();
    } else {
      Alert.alert("No se pudo completar la compra", result.error);
    }
  }

  async function handleRestore() {
    setLoading(true);
    const result = await restorePurchases();
    setLoading(false);
    if (result.success && result.hasFullAccess) {
      onPurchased();
    } else if (result.success) {
      Alert.alert("Sin compras previas", "No encontramos una compra activa para restaurar.");
    } else {
      Alert.alert("Error", result.error);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <ThemeToggle />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Desbloquea el banco completo</Text>
        <Text style={styles.description}>
          Acceso de por vida a todas las preguntas oficiales del examen, modo de examen simulado
          ilimitado y seguimiento de tu progreso. Pago único, sin suscripciones.
        </Text>

        <View style={styles.priceBox}>
          <Text style={styles.price}>{priceLabel}</Text>
          <Text style={styles.priceNote}>Pago único · una sola vez</Text>
        </View>

        <TouchableOpacity style={styles.buyButton} onPress={handleBuy} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <Text style={styles.buyButtonText}>Comprar ahora</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleRestore} disabled={loading}>
          <Text style={styles.restoreText}>Restaurar compra</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    content: { flex: 1, padding: 24, justifyContent: "center" },
    closeButton: {},
    closeText: { fontSize: 20, color: colors.textMuted },
    title: { fontSize: 24, fontWeight: "700", textAlign: "center", marginBottom: 12, color: colors.text },
    description: {
      fontSize: 15,
      textAlign: "center",
      color: colors.textMuted,
      marginBottom: 24,
      lineHeight: 22,
    },
    priceBox: { alignItems: "center", marginBottom: 24 },
    price: { fontSize: 32, fontWeight: "800", color: colors.text },
    priceNote: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    buyButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 16, marginBottom: 16 },
    buyButtonText: { color: colors.buttonText, textAlign: "center", fontSize: 17, fontWeight: "700" },
    restoreText: { textAlign: "center", color: colors.primary, fontSize: 14 },
  });
}
