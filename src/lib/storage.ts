import AsyncStorage from "@react-native-async-storage/async-storage";
import { ExamResult, PurchaseState } from "../types";
import { ThemeMode } from "../theme";

const KEYS = {
  purchase: "@driving_exam/purchase_state",
  history: "@driving_exam/exam_history",
  themeMode: "@driving_exam/theme_mode",
};

export async function getPurchaseState(): Promise<PurchaseState> {
  const raw = await AsyncStorage.getItem(KEYS.purchase);
  if (!raw) {
    return { hasFullAccess: false, lastChecked: new Date().toISOString() };
  }
  return JSON.parse(raw) as PurchaseState;
}

export async function setPurchaseState(state: PurchaseState): Promise<void> {
  await AsyncStorage.setItem(KEYS.purchase, JSON.stringify(state));
}

export async function getExamHistory(): Promise<ExamResult[]> {
  const raw = await AsyncStorage.getItem(KEYS.history);
  if (!raw) return [];
  return JSON.parse(raw) as ExamResult[];
}

export async function addExamResult(result: ExamResult): Promise<void> {
  const history = await getExamHistory();
  history.unshift(result); // más reciente primero
  await AsyncStorage.setItem(KEYS.history, JSON.stringify(history.slice(0, 50)));
}

// Modo de tema (claro/oscuro) elegido manualmente por el usuario. Si nunca
// lo ha elegido, devuelve null y la app usa el modo del sistema operativo.
export async function getSavedThemeMode(): Promise<ThemeMode | null> {
  const raw = await AsyncStorage.getItem(KEYS.themeMode);
  return raw === "light" || raw === "dark" ? raw : null;
}

export async function setSavedThemeMode(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(KEYS.themeMode, mode);
}
