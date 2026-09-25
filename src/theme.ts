// Paleta de marca de AUTOALIANZA - Centro de Enseñanza Automovilística S.A.S.
// Colores extraídos directamente (con pipeta) del logo real: azul de "AUTO",
// negro de "ALIANZA" y el degradado amarillo-ámbar-naranja-rojo del
// velocímetro. Ahora la app soporta modo claro y modo oscuro; los colores de
// marca/velocímetro se mantienen iguales en ambos modos, y el resto de la
// paleta (fondo, texto, tarjetas, bordes) cambia según el modo.

export type ThemeMode = "light" | "dark";

export interface ThemeColors {
  mode: ThemeMode;

  // Marca / acciones principales
  primary: string;
  primaryDark: string;

  // Texto y superficies
  text: string; // texto principal (antes "dark")
  textMuted: string;
  background: string; // fondo general de pantalla
  card: string; // tarjetas, encabezados, superficies elevadas
  cardBorder: string; // bordes sutiles (headers, separadores)
  inputBorder: string; // bordes de opciones/inputs

  // Estados
  success: string;
  successBg: string;
  danger: string;
  dangerBg: string;
  selectedBg: string;

  warningBg: string;
  warningBorder: string;
  warningText: string;

  buttonText: string; // texto sobre botones de color sólido

  // Degradado del velocímetro del logo (bajo -> medio -> alto), igual en
  // ambos modos porque es color de marca, no de UI
  gaugeLow: string;
  gaugeAmber: string;
  gaugeMid: string;
  gaugeHigh: string;
}

const brand = {
  gaugeLow: "#F8E906",
  gaugeAmber: "#FEBC0E",
  gaugeMid: "#F79818",
  gaugeHigh: "#EF4C21",
};

export const lightColors: ThemeColors = {
  mode: "light",

  primary: "#0D88D8",
  primaryDark: "#0A6BAA",

  text: "#231F20",
  textMuted: "#555555",
  background: "#F5F7FA",
  card: "#FFFFFF",
  cardBorder: "#EEEEEE",
  inputBorder: "#D0D0D0",

  success: "#16a34a",
  successBg: "#F0FDF4",
  danger: "#dc2626",
  dangerBg: "#FEF2F2",
  selectedBg: "#EAF4FC",

  warningBg: "#FFF7ED",
  warningBorder: brand.gaugeMid,
  warningText: "#92400E",

  buttonText: "#FFFFFF",

  ...brand,
};

export const darkColors: ThemeColors = {
  mode: "dark",

  primary: "#3EA6F2",
  primaryDark: "#0A6BAA",

  text: "#F2F2F2",
  textMuted: "#AEB4BD",
  background: "#14161A",
  card: "#1F2229",
  cardBorder: "#2E323B",
  inputBorder: "#3A3F4A",

  success: "#34D399",
  successBg: "#123322",
  danger: "#F87171",
  dangerBg: "#3B1414",
  selectedBg: "#123049",

  warningBg: "#3A2A10",
  warningBorder: brand.gaugeMid,
  warningText: "#FFD79A",

  buttonText: "#FFFFFF",

  ...brand,
};

export const appName = "AUTOALIANZA - ET";
export const appTagline = "La conducción en tus manos";

// Alias de compatibilidad: versiones anteriores de este proyecto exportaban
// un solo objeto `colors` (sin modo claro/oscuro). Si por accidente queda
// algún archivo viejo con `import { colors } from "../theme"` (por ejemplo,
// por no haber reemplazado TODA la carpeta `src` al actualizar), este alias
// evita un crash total de la app ("Cannot read property '...' of undefined")
// y en su lugar usa la paleta clara como respaldo. Lo ideal es que ningún
// archivo nuevo use esto — todos deben leer los colores con `useTheme()`.
export const colors = lightColors;
