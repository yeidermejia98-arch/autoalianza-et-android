import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  InteractionManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeColors } from "../theme";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";
import { Sign, SignCategoryKey } from "../data/senalesTransito";
import { useSignsData } from "../context/ContentContext";

// Catálogo de señales de tránsito. La lista base (SIGN_CATEGORIES / SIGNS)
// viene de src/data/senalesTransito.ts (recorte automático del Manual de
// Señalización Vial 2024 oficial), pero esta pantalla la obtiene a través de
// useSignsData(), que la mantiene sincronizada con lo que se edite desde el
// panel administrativo (nombre, significado, categoría, señales nuevas),
// sin perder las imágenes ya incluidas en la app. Esta pantalla solo
// presenta ese catálogo: buscador, filtro por categoría y una tarjeta de
// detalle al tocar una señal. El juego didáctico de reconocimiento queda
// para una siguiente entrega.

interface Props {
  onBack: () => void;
  onOpenLink: (url: string) => void;
}

const MANUAL_SENALIZACION_URL =
  "https://ansv.gov.co/sites/default/files/2025/Publicaciones/Manual_de_Senalizacion_Vial/Manual_de_Senalizacion_Vial.pdf";

const NUM_COLUMNS = 3;

interface FilterChip {
  key: SignCategoryKey | "ALL";
  shortLabel: string;
  accentColor: string;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export default function SenalesTransitoScreen({ onBack, onOpenLink }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { categories: SIGN_CATEGORIES, signs: SIGNS } = useSignsData();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<SignCategoryKey | "ALL">("ALL");
  const [selected, setSelected] = useState<Sign | null>(null);
  // Igual que en Código de Tránsito: diferimos el montaje de la grilla hasta
  // después de la transición de entrada, para que el cross-fade de App.tsx
  // no tenga que esperar a que se monten 217 tarjetas con imagen de una vez.
  const [listReady, setListReady] = useState(false);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => setListReady(true));
    return () => handle.cancel();
  }, []);

  const filtered = useMemo(() => {
    const query = normalize(search.trim());
    return SIGNS.filter((s) => {
      if (category !== "ALL" && s.category !== category) return false;
      if (!query) return true;
      return normalize(s.code).includes(query) || normalize(s.name).includes(query);
    });
  }, [search, category, SIGNS]);

  const categoryInfo = useCallback(
    (key: SignCategoryKey) => SIGN_CATEGORIES.find((c) => c.key === key)!,
    [SIGN_CATEGORIES]
  );

  const filterChips: FilterChip[] = useMemo(
    () => [
      { key: "ALL", shortLabel: "Todas", accentColor: colors.primary },
      ...SIGN_CATEGORIES.map((c) => ({ key: c.key, shortLabel: c.shortLabel, accentColor: c.accentColor })),
    ],
    [colors.primary, SIGN_CATEGORIES]
  );

  const renderItem = useCallback(
    ({ item }: { item: Sign }) => {
      const info = categoryInfo(item.category);
      return (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => setSelected(item)}
        >
          <View style={styles.thumbWrap}>
            <Image source={item.image} style={styles.thumb} resizeMode="contain" />
          </View>
          <Text style={[styles.cardCode, { color: info.accentColor }]}>{item.code}</Text>
          <Text style={styles.cardName} numberOfLines={2}>
            {item.name}
          </Text>
        </TouchableOpacity>
      );
    },
    [styles, categoryInfo]
  );

  const keyExtractor = useCallback((item: Sign) => item.code, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Señales de Tránsito
        </Text>
        <ThemeToggle />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por código o nombre..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        <FlatList<FilterChip>
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          data={filterChips}
          keyExtractor={(c) => c.key}
          renderItem={({ item }) => {
            const active = category === item.key;
            const count = item.key === "ALL" ? SIGNS.length : SIGNS.filter((s) => s.category === item.key).length;
            return (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { borderColor: item.accentColor },
                  active && { backgroundColor: item.accentColor },
                ]}
                onPress={() => setCategory(item.key)}
              >
                <Text style={[styles.filterChipText, { color: active ? "#FFFFFF" : item.accentColor }]}>
                  {item.shortLabel} ({count})
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <TouchableOpacity onPress={() => onOpenLink(MANUAL_SENALIZACION_URL)}>
        <Text style={styles.manualLink}>📘 Ver el Manual de Señalización Vial oficial</Text>
      </TouchableOpacity>

      {!listReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No se encontraron señales con ese criterio.</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
          removeClippedSubviews={false}
          disableVirtualization
          initialNumToRender={30}
          columnWrapperStyle={styles.row}
        />
      )}

      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {selected ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalScrollContent}>
                  <Image source={selected.image} style={styles.modalImage} resizeMode="contain" />
                  <Text style={[styles.modalCode, { color: categoryInfo(selected.category).accentColor }]}>
                    {selected.code}
                  </Text>
                  <Text style={styles.modalName}>{selected.name}</Text>
                  <View
                    style={[
                      styles.modalCategoryBadge,
                      { borderColor: categoryInfo(selected.category).accentColor },
                    ]}
                  >
                    <Text style={[styles.modalCategoryText, { color: categoryInfo(selected.category).accentColor }]}>
                      {categoryInfo(selected.category).label}
                    </Text>
                  </View>
                  <Text style={styles.modalDescription}>{categoryInfo(selected.category).description}</Text>
                  {selected.meaning ? (
                    <View style={styles.modalMeaningBox}>
                      <Text style={styles.modalMeaningLabel}>¿Qué significa?</Text>
                      <Text style={styles.modalMeaningText}>{selected.meaning}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelected(null)}>
                    <Text style={styles.modalCloseButtonText}>Cerrar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
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
    searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.text },
    clearButtonText: { color: colors.textMuted, fontSize: 16, paddingLeft: 8 },

    filterRow: { marginTop: 10 },
    filterContent: { paddingHorizontal: 16, gap: 8 },
    filterChip: {
      borderWidth: 1.5,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 14,
      marginRight: 8,
    },
    filterChipText: { fontSize: 13, fontWeight: "700" },
    manualLink: {
      fontSize: 12.5,
      color: colors.primary,
      textAlign: "center",
      marginTop: 8,
    },

    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
    emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    emptyText: { textAlign: "center", color: colors.textMuted, fontSize: 14 },

    list: { flex: 1, marginTop: 12 },
    listContent: { paddingHorizontal: 12, paddingBottom: 40 },
    row: { justifyContent: "flex-start" },

    card: {
      flex: 1 / NUM_COLUMNS,
      maxWidth: `${100 / NUM_COLUMNS}%`,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      margin: 4,
      padding: 8,
      alignItems: "center",
    },
    thumbWrap: {
      width: "100%",
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    thumb: { width: "100%", height: "100%" },
    cardCode: { fontSize: 11.5, fontWeight: "800", marginBottom: 2 },
    cardName: { fontSize: 11, color: colors.textMuted, textAlign: "center", lineHeight: 14 },

    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    modalCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      width: "100%",
      maxWidth: 340,
      maxHeight: "85%",
    },
    modalScrollContent: { alignItems: "center" },
    modalImage: { width: 140, height: 140, marginBottom: 12 },
    modalCode: { fontSize: 15, fontWeight: "800", marginBottom: 2 },
    modalName: { fontSize: 17, fontWeight: "700", color: colors.text, textAlign: "center", marginBottom: 10 },
    modalCategoryBadge: {
      borderWidth: 1.5,
      borderRadius: 20,
      paddingVertical: 4,
      paddingHorizontal: 12,
      marginBottom: 10,
    },
    modalCategoryText: { fontSize: 12, fontWeight: "700" },
    modalDescription: { fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 19, marginBottom: 16 },
    modalMeaningBox: {
      width: "100%",
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 12,
      marginBottom: 16,
    },
    modalMeaningLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 4,
    },
    modalMeaningText: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
    modalCloseButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 28,
    },
    modalCloseButtonText: { color: colors.buttonText, fontSize: 14, fontWeight: "700" },
  });
}
