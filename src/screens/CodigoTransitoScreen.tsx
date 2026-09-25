import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  InteractionManager,
  Platform,
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeColors } from "../theme";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";
import { FUENTE_OFICIAL_URL, ArticuloRef } from "../data/codigoTransito";
import { useCodigoTitulos } from "../context/ContentContext";

interface Props {
  onBack: () => void;
  onOpenLink: (url: string) => void;
}

interface Section {
  key: string;
  tituloLabel: string;
  capituloLabel: string;
  data: ArticuloRef[];
}

function normalize(text: string): string {
  const decomposed = text.normalize("NFD");
  let result = "";
  for (let i = 0; i < decomposed.length; i++) {
    const code = decomposed.charCodeAt(i);
    if (code >= 0x0300 && code <= 0x036f) continue;
    result += decomposed[i];
  }
  return result.toLowerCase();
}

function isParagrafo(paragraph: string): boolean {
  return normalize(paragraph.trim()).startsWith("paragrafo");
}

// Separa el rótulo inicial ("PARÁGRAFO 1°.") del resto del párrafo para
// poder resaltar solo el rótulo en negrita dentro de la caja destacada.
function splitParagrafoLabel(paragraph: string): [string, string] {
  const match = paragraph.match(/^([^.]{1,40}\.)\s*([\s\S]*)$/);
  if (match) return [match[1], match[2]];
  return ["", paragraph];
}

// Líneas que enumeran elementos se muestran como lista (sin justificar, más
// compactas) en vez de como un párrafo corrido. Esto incluye:
// - las que marcamos nosotros con un guion al inicio ("- Elemento", p. ej.
//   las autoridades de tránsito del artículo 3);
// - las que el propio texto legal ya trae enumeradas con letra ("a) ...") o
//   número ("1. ...", p. ej. los organismos de tránsito del artículo 6 o los
//   registros del RUNT en el artículo 8) — esas no se reemplazan por guiones
//   porque la letra/número es parte de la referencia legal del literal;
// - las enumeradas con letra MAYÚSCULA y subnumeración ("A.", "A.1.",
//   "C.12 A.", p. ej. las categorías de sanción del artículo 131) — mismo
//   caso, es la propia referencia legal del literal;
// - las definiciones tipo glosario que empiezan con un término en negrita
//   seguido de dos puntos ("**Término:** definición...", p. ej. el artículo
//   2) — ahí el término en negrita ya funciona como marcador visual, así
//   que no llevan guion.
function isListItem(paragraph: string): boolean {
  const trimmed = paragraph.trim();
  return (
    trimmed.startsWith("- ") ||
    /^[a-z]\)\s/i.test(trimmed) ||
    /^\d{1,2}\.\s/.test(trimmed) ||
    /^[A-Z]\.(\d{1,3}(\s[A-Z])?)?\.?\s/.test(trimmed) ||
    /^\*\*[^*]+:\*\*/.test(trimmed)
  );
}

// Interpreta **texto** dentro de un párrafo como negrita, devolviendo los
// segmentos ya listos para renderizar dentro de un <Text>. El texto plano
// (sin marcador) no lleva estilo propio: hereda el del <Text> padre que lo
// envuelve, tal como funciona el anidamiento de <Text> en React Native.
function renderWithBold(
  text: string,
  keyPrefix: string,
  boldStyle: object
): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((part) => part.length > 0);
  return parts.map((part, i) => {
    const isBold = part.startsWith("**") && part.endsWith("**");
    if (!isBold) {
      return <Text key={`${keyPrefix}-${i}`}>{part}</Text>;
    }
    return (
      <Text key={`${keyPrefix}-${i}`} style={boldStyle}>
        {part.slice(2, -2)}
      </Text>
    );
  });
}

const SCROLL_TOP_THRESHOLD = 500;

export default function CodigoTransitoScreen({ onBack, onOpenLink }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // CODIGO_TRANSITO_TITULOS viene de Supabase (con caché y respaldo local vía
  // useCodigoTitulos) en vez de importarse directo del archivo empacado, así
  // que los artículos que se editen desde el panel administrativo aparecen
  // aquí sin necesidad de un build nuevo.
  const CODIGO_TRANSITO_TITULOS = useCodigoTitulos();
  const [search, setSearch] = useState("");
  const [expandedArt, setExpandedArt] = useState<Record<string, boolean>>({});
  const listRef = useRef<SectionList<ArticuloRef, Section>>(null);
  // La pantalla aparece de inmediato con solo el encabezado y el buscador
  // (liviano); la lista completa (177 artículos, sin virtualizar para evitar
  // el salto de scroll) se monta un instante después, ya con la pantalla
  // visible. Así el cross-fade de App.tsx no queda esperando a que se
  // dibuje todo de golpe, y la navegación se siente rápida otra vez.
  const [listReady, setListReady] = useState(false);
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      setListReady(true);
    });
    return () => handle.cancel();
  }, []);
  // Valor animado nativo para la posición de scroll: el botón "subir al
  // inicio" se muestra/oculta interpolando su opacidad directamente en el
  // hilo nativo (useNativeDriver), sin pasar por setState de React en cada
  // evento de scroll. Antes eso disparaba renders de React durante el fling
  // en Android, que combinados con encabezados pegajosos y tarjetas de alto
  // variable, provocaban el salto/parpadeo de contenido reportado.
  const scrollY = useRef(new Animated.Value(0)).current;
  // useNativeDriver: false a propósito. El driver nativo solo funciona con
  // componentes envueltos en Animated.createAnimatedComponent, y un
  // SectionList normal no lo está (envolverlo complica el ref de
  // scrollToLocation). Sin driver nativo la interpolación corre en JS, pero
  // sigue sin disparar re-renders de React en cada evento de scroll (que
  // era el problema original con setState), así que el objetivo se cumple
  // igual para un botón que solo cambia de opacidad.
  const handleScroll = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: false,
    })
  ).current;
  const scrollTopOpacity = scrollY.interpolate({
    inputRange: [SCROLL_TOP_THRESHOLD - 1, SCROLL_TOP_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const query = normalize(search.trim());

  const sections = useMemo<Section[]>(() => {
    const result: Section[] = [];
    CODIGO_TRANSITO_TITULOS.forEach((titulo) => {
      const tituloLabel = `TÍTULO ${titulo.numero} · ${titulo.nombre}`;
      titulo.capitulos.forEach((cap) => {
        const capituloLabel = `Capítulo ${cap.numero} · ${cap.nombre}`;
        let articulos = cap.articulos;
        if (query) {
          const capMatches = normalize(`${tituloLabel} ${capituloLabel}`).includes(query);
          if (!capMatches) {
            articulos = cap.articulos.filter((art) =>
              normalize(`articulo ${art.numero} ${art.encabezado} ${art.texto}`).includes(query)
            );
          }
        }
        if (articulos.length > 0) {
          result.push({
            key: `${titulo.numero}-${cap.numero}-${cap.nombre}`,
            tituloLabel,
            capituloLabel,
            data: articulos,
          });
        }
      });
    });
    return result;
  }, [query, CODIGO_TRANSITO_TITULOS]);

  const toggleArt = useCallback((key: string) => {
    setExpandedArt((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  function scrollToTop() {
    if (sections.length === 0) return;
    listRef.current?.scrollToLocation({
      sectionIndex: 0,
      itemIndex: 0,
      viewOffset: 0,
      animated: true,
    });
  }

  const keyExtractor = useCallback((item: ArticuloRef) => item.numero, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitulo}>{section.tituloLabel}</Text>
        <Text style={styles.sectionCapitulo}>{section.capituloLabel}</Text>
      </View>
    ),
    [styles]
  );

  const renderItem = useCallback(
    ({ item, section }: { item: ArticuloRef; section: Section }) => {
      const artKey = `${section.key}-${item.numero}`;
      const isOpen = !!expandedArt[artKey];
      return (
        <TouchableOpacity
          style={styles.artCard}
          onPress={() => toggleArt(artKey)}
          activeOpacity={0.8}
        >
          <View style={styles.artHeaderRow}>
            <View style={styles.artBadge}>
              <Text style={styles.artBadgeText}>Art. {item.numero}</Text>
            </View>
            <Text style={styles.artHeading} numberOfLines={isOpen ? undefined : 3}>
              {item.encabezado || `Artículo ${item.numero}`}
            </Text>
          </View>

          {isOpen ? (
            <View style={styles.artBody}>
              {item.notas.length > 0 ? (
                <Text style={styles.artNotas}>
                  {item.notas.map((n) => `[${n}]`).join(" ")}
                </Text>
              ) : null}
              {item.texto
                .split("\n")
                .filter((p) => p.trim().length > 0)
                .map((paragraph, idx) => {
                  if (isParagrafo(paragraph)) {
                    const [label, rest] = splitParagrafoLabel(paragraph.trim());
                    return (
                      <View key={idx} style={styles.paragrafoBox}>
                        <Text style={styles.paragrafoText}>
                          {label ? (
                            <Text style={styles.paragrafoLabel}>{label} </Text>
                          ) : null}
                          {renderWithBold(rest, `${idx}-rest`, styles.inlineBold)}
                        </Text>
                      </View>
                    );
                  }
                  if (isListItem(paragraph)) {
                    return (
                      <Text key={idx} style={styles.artListItem}>
                        {renderWithBold(paragraph.trim(), `${idx}-li`, styles.inlineBold)}
                      </Text>
                    );
                  }
                  return (
                    <Text key={idx} style={styles.artParagraph}>
                      {renderWithBold(paragraph.trim(), `${idx}-p`, styles.inlineBold)}
                    </Text>
                  );
                })}
            </View>
          ) : null}
        </TouchableOpacity>
      );
    },
    [expandedArt, styles, toggleArt]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Código de Tránsito
        </Text>
        <ThemeToggle />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por título, capítulo, artículo o palabra clave..."
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

      {!listReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
      <SectionList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        sections={sections}
        keyExtractor={keyExtractor}
        stickySectionHeadersEnabled
        // En Android, "removeClippedSubviews" (activado por defecto) combinado
        // con encabezados pegajosos y tarjetas de alto variable (se expanden
        // al tocarlas) es una causa conocida de que las filas parpadeen,
        // se vean en blanco o "salten" al hacer scroll rápido.
        removeClippedSubviews={false}
        // Causa raíz del salto de contenido hacia atrás y las pantallas en
        // blanco: sin esto, la lista virtualiza (monta/desmonta) las filas
        // según una ALTURA ESTIMADA, y como cada tarjeta tiene un alto real
        // distinto (encabezados de 1 a 3 líneas, 33 secciones con alturas muy
        // distintas), esa estimación se desvía mucho durante un scroll rápido.
        // Confirmado: esto sí soluciona el salto/parpadeo. Como ahora el
        // montaje se difiere con InteractionManager (ver listReady arriba),
        // este costo ya no bloquea la transición de entrada a la pantalla.
        disableVirtualization
        initialNumToRender={40}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No se encontraron resultados.</Text>
        }
        ListFooterComponent={
          <TouchableOpacity onPress={() => onOpenLink(FUENTE_OFICIAL_URL)}>
            <Text style={styles.sourceLink}>
              Verificar vigencia en el Gestor Normativo (Función Pública) ↗
            </Text>
          </TouchableOpacity>
        }
      />
      )}

      <Animated.View
        pointerEvents="box-none"
        style={[styles.scrollTopButton, { opacity: scrollTopOpacity }]}
      >
        <TouchableOpacity
          style={styles.scrollTopTouchable}
          onPress={scrollToTop}
          accessibilityLabel="Subir al inicio"
        >
          <Text style={styles.scrollTopIcon}>▲</Text>
        </TouchableOpacity>
      </Animated.View>
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
    list: { flex: 1, marginTop: 12 },
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
    emptyText: { textAlign: "center", color: colors.textMuted, marginTop: 24 },

    sectionHeader: {
      backgroundColor: colors.background,
      paddingTop: 10,
      paddingBottom: 8,
    },
    sectionTitulo: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    sectionCapitulo: {
      fontSize: 13.5,
      fontWeight: "700",
      color: colors.text,
      marginTop: 2,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      overflow: "hidden",
    },

    artCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 14,
      marginBottom: 10,
    },
    artHeaderRow: { flexDirection: "row", alignItems: "flex-start" },
    artBadge: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginRight: 12,
    },
    artBadgeText: { color: colors.buttonText, fontSize: 12.5, fontWeight: "700" },
    artHeading: {
      flex: 1,
      fontSize: 14.5,
      fontWeight: "700",
      color: colors.text,
      textTransform: "uppercase",
      lineHeight: 20,
    },
    artBody: {
      marginTop: 14,
    },
    artNotas: {
      fontSize: 11.5,
      color: colors.textMuted,
      fontStyle: "italic",
      marginBottom: 8,
    },
    // Justificado solo en Android: en iOS el motor de texto nativo
    // (TextKit) reparte el espacio extra únicamente entre palabras, y con
    // texto legal en español (muchas tildes, palabras largas, "°") eso
    // puede verse distorsionado — se probó forzarlo también en iOS y se
    // revirtió a pedido expreso. Si se quiere justificado real en iOS,
    // la vía correcta es renderizar el texto vía WebView/HTML en esa
    // plataforma en vez de <Text> nativo.
    artParagraph: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.text,
      textAlign: Platform.OS === "android" ? "justify" : "left",
      marginBottom: 12,
    },
    // Líneas de enumeración ("- Elemento", o "a)"/"1." que ya trae el texto
    // legal): un poco más compactas que un párrafo normal, pero sin quedar
    // apretadas entre sí (marginBottom subido de 4 a 8 a pedido expreso,
    // para que respiren más sin llegar al espaciado de un párrafo completo).
    // Mismo criterio de justificado por plataforma que artParagraph para que
    // no se vean inconsistentes con el resto del artículo.
    artListItem: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.text,
      textAlign: Platform.OS === "android" ? "justify" : "left",
      marginBottom: 8,
      paddingLeft: 4,
    },
    // Negrita en línea dentro de cualquier párrafo, a partir de **texto**
    // en el campo `texto` de Supabase.
    inlineBold: {
      fontWeight: "700",
    },
    paragrafoBox: {
      backgroundColor: colors.selectedBg,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    paragrafoText: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.text,
      textAlign: Platform.OS === "android" ? "justify" : "left",
    },
    paragrafoLabel: {
      fontWeight: "700",
    },
    sourceLink: {
      textAlign: "center",
      fontSize: 12.5,
      color: colors.primary,
      marginTop: 8,
      textDecorationLine: "underline",
    },

    scrollTopButton: {
      position: "absolute",
      right: 18,
      bottom: 24,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 6,
    },
    scrollTopTouchable: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    scrollTopIcon: { color: colors.buttonText, fontSize: 16, fontWeight: "700" },
  });
}
