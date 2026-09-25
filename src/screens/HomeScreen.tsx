import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemeColors } from "../theme";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";

export interface ManualLink {
  title: string;
  url: string;
}

interface Props {
  hasFullAccess: boolean;
  examLabel: string;
  onStartPractice: () => void;
  onStartExam: () => void;
  onOpenPaywall: () => void;
  onOpenManuales: () => void;
  onOpenCodigo: () => void;
  onOpenSenales: () => void;
  onOpenHorarios: () => void;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const DRAWER_WIDTH = Math.min(300, SCREEN_WIDTH * 0.82);
const ANIM_OPEN_MS = 280;
const ANIM_CLOSE_MS = 240;
// Curva "decelerate" al abrir (arranca rápido y frena suave, como si el
// panel llegara a su lugar) y "accelerate" al cerrar (arranca suave y
// acelera hacia afuera). Es el mismo par de curvas que usan los menús
// laterales nativos de Android/iOS, y se ve mucho más natural que la curva
// pareja que usa Animated.timing por defecto.
const EASING_OPEN = Easing.out(Easing.cubic);
const EASING_CLOSE = Easing.in(Easing.cubic);

interface MenuItem {
  key: string;
  emoji?: string;
  iconName?: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  active?: boolean;
  onPress: () => void;
}

export default function HomeScreen({
  hasFullAccess,
  examLabel,
  onStartPractice,
  onStartExam,
  onOpenPaywall,
  onOpenManuales,
  onOpenCodigo,
  onOpenSenales,
  onOpenHorarios,
}: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [menuMounted, setMenuMounted] = useState(false);
  const slideX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  function openMenu() {
    setMenuMounted(true);
  }

  useEffect(() => {
    if (menuMounted) {
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: 0,
          duration: ANIM_OPEN_MS,
          easing: EASING_OPEN,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: ANIM_OPEN_MS,
          easing: EASING_OPEN,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuMounted]);

  // onDone corre DESPUÉS de que el panel terminó de deslizarse hacia afuera,
  // nunca antes. Esto es lo que evita que la navegación "corte" la animación
  // a la mitad cuando se toca una opción del menú.
  function closeMenu(onDone?: () => void) {
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: -DRAWER_WIDTH,
        duration: ANIM_CLOSE_MS,
        easing: EASING_CLOSE,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: ANIM_CLOSE_MS,
        easing: EASING_CLOSE,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMenuMounted(false);
      onDone?.();
    });
  }

  function go(action: () => void) {
    closeMenu(action);
  }

  const menuItems: MenuItem[] = [
    { key: "home", emoji: "🏠", label: "Principal", active: true, onPress: () => closeMenu() },
    { key: "manuales", iconName: "book-outline", label: "Manuales", onPress: () => go(onOpenManuales) },
    { key: "codigo", iconName: "reader-outline", label: "Código de Tránsito", onPress: () => go(onOpenCodigo) },
    { key: "senales", iconName: "warning-outline", label: "Señales de Tránsito", onPress: () => go(onOpenSenales) },
    { key: "horarios", iconName: "calendar-outline", label: "Horarios de Clases", onPress: () => go(onOpenHorarios) },
  ];

  return (
    <ImageBackground
      source={require("../../assets/background.png")}
      style={styles.background}
      resizeMode="cover"
    >
      {/* El fondo se diseñó para modo claro; en modo oscuro le ponemos una
          capa semitransparente encima para que combine con el resto de la
          app sin perder el logo ni las ilustraciones. */}
      {isDark ? <View style={styles.darkOverlay} pointerEvents="none" /> : null}

      <SafeAreaView style={styles.container}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={openMenu}
            accessibilityLabel="Abrir menú"
          >
            <Text style={styles.menuButtonText}>☰</Text>
          </TouchableOpacity>
          <ThemeToggle />
        </View>

        <View style={styles.content}>
          {/* Quitamos por completo el título ("Simulador de Examen") y el
              subtítulo (examLabel): ambos eran puramente decorativos/
              informativos — el logo y el nombre de la app ya están en la
              imagen de fondo — y eran los elementos que, en distintos
              dispositivos (iPad) o con el tamaño de letra del sistema
              aumentado, terminaban desplazándose y sobreponiéndose con el
              logo. Sin ningún texto flotando sobre la imagen, no hay nada
              que se pueda sobreponer, sin importar el dispositivo o el
              tamaño de letra. (Mismo ajuste que se hizo para la versión
              enviada a Apple.) */}

          <TouchableOpacity style={styles.primaryButton} onPress={onStartPractice}>
            <Text style={styles.primaryButtonText}>Práctica libre</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={onStartExam}>
            <Text style={styles.primaryButtonText}>Examen simulado cronometrado</Text>
          </TouchableOpacity>

          {!hasFullAccess ? (
            <TouchableOpacity style={styles.paywallButton} onPress={onOpenPaywall}>
              <Text style={styles.paywallButtonText}>🔓 Desbloquear banco completo</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.unlockedText}>✅ Ya tienes acceso completo</Text>
          )}
        </View>
      </SafeAreaView>

      <Modal
        visible={menuMounted}
        transparent
        animationType="none"
        onRequestClose={() => closeMenu()}
      >
        <View style={styles.modalRoot}>
          <Animated.View
            style={[styles.backdrop, { opacity: backdropOpacity }]}
            pointerEvents={menuMounted ? "auto" : "none"}
          >
            <Pressable style={styles.backdropPress} onPress={() => closeMenu()} />
          </Animated.View>

          <Animated.View style={[styles.drawer, { transform: [{ translateX: slideX }] }]}>
            <SafeAreaView style={styles.drawerSafe}>
              <View style={styles.drawerHeader}>
                <View style={styles.logoCard}>
                  <Image
                    source={require("../../assets/brand-logo.png")}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
                <TouchableOpacity
                  style={styles.drawerCloseButton}
                  onPress={() => closeMenu()}
                  accessibilityLabel="Cerrar menú"
                >
                  <Text style={styles.drawerCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.drawerDivider} />

              <View style={styles.drawerItems}>
                {menuItems.map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.drawerItem, item.active ? styles.drawerItemActive : null]}
                    onPress={item.onPress}
                  >
                    {item.emoji ? (
                      <Text style={styles.drawerItemIcon}>{item.emoji}</Text>
                    ) : (
                      <Ionicons
                        name={item.iconName!}
                        size={19}
                        color={colors.text}
                        style={styles.drawerItemIcon}
                      />
                    )}
                    <Text style={styles.drawerItemLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.drawerFooter}>
                <Text style={styles.drawerFooterText}>© AUTOALIANZA - ET</Text>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    background: { flex: 1, width: "100%", height: "100%" },
    darkOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(8, 10, 14, 0.6)",
    },
    container: { flex: 1 },
    toggleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    menuButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0, 0, 0, 0.35)",
    },
    menuButtonText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700", lineHeight: 20 },
    // El fondo ya trae el logo y las ilustraciones en la mitad superior de la
    // imagen, así que el contenido (botones) se ancla hacia la parte
    // inferior de la pantalla para no tapar el logo. Subimos un poco el
    // bloque de botones (más "paddingBottom" = más separado del borde
    // inferior = más cerca del logo) para que no quede tanto espacio vacío
    // entre el logo y los botones, pero dejando un margen prudente para que
    // en pantallas con otra proporción (como el iPad que usa Apple al
    // revisar la app) los botones no lleguen a sobreponerse con el logo.
    content: { flex: 1, justifyContent: "flex-end", padding: 24, paddingBottom: 170 },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 16,
      marginBottom: 14,
    },
    primaryButtonText: { color: colors.buttonText, textAlign: "center", fontSize: 16, fontWeight: "600" },
    paywallButton: {
      backgroundColor: colors.gaugeMid,
      borderRadius: 10,
      paddingVertical: 16,
      marginTop: 10,
    },
    paywallButtonText: { color: colors.buttonText, textAlign: "center", fontSize: 16, fontWeight: "700" },
    unlockedText: { textAlign: "center", color: colors.success, marginTop: 16, fontSize: 15 },

    // --- Menú lateral (drawer) ---
    modalRoot: { ...StyleSheet.absoluteFillObject, flex: 1 },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    backdropPress: { flex: 1 },
    drawer: {
      position: "absolute",
      top: 0,
      left: 0,
      height: "100%",
      width: DRAWER_WIDTH,
      backgroundColor: colors.card,
      shadowColor: "#000",
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 16,
    },
    drawerSafe: { flex: 1 },
    drawerHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingTop: 36,
    },
    logoCard: {
      flex: 1,
      backgroundColor: "#FFFFFF",
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    logoImage: { width: "100%", height: 50 },
    drawerCloseButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.selectedBg,
      marginLeft: 10,
    },
    drawerCloseText: { color: colors.text, fontSize: 15, fontWeight: "700" },
    drawerDivider: {
      height: 1,
      backgroundColor: colors.cardBorder,
      marginTop: 22,
      marginBottom: 10,
    },
    drawerItems: { flex: 1, paddingTop: 10 },
    drawerItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderRadius: 10,
      marginHorizontal: 8,
      marginBottom: 4,
    },
    drawerItemActive: {
      backgroundColor: colors.selectedBg,
    },
    drawerItemIcon: { fontSize: 18, width: 30 },
    drawerItemLabel: { fontSize: 15.5, fontWeight: "600", color: colors.text },
    drawerFooter: {
      paddingHorizontal: 20,
      paddingBottom: 18,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      paddingTop: 14,
    },
    drawerFooterText: { fontSize: 12, color: colors.textMuted },
  });
}
