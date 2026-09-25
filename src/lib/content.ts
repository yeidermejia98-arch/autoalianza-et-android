// Capa de sincronización de contenido con Supabase.
//
// Estrategia (para no romper nada y que la app funcione siempre, con o sin
// internet):
//   1. Al iniciar, se usa el contenido YA EMPACADO en la app (questions.json,
//      senalesTransito.ts, codigoTransito.ts) como base — exactamente el
//      comportamiento actual.
//   2. Si hay una copia en caché (de una sincronización anterior), se usa
//      esa en su lugar (más reciente que lo empacado en el build).
//   3. En segundo plano, se intenta descargar la versión más reciente desde
//      Supabase. Si funciona, se actualiza el contenido en pantalla (sin
//      reiniciar la app) y se guarda en caché para la próxima vez.
//   4. Si falla (sin internet, Supabase caído, etc.), no pasa nada: se
//      sigue usando lo que ya había (caché o el contenido empacado).
//
// Las imágenes de las 217 señales ya existentes se mantienen SIEMPRE como
// parte del build (con require(), igual que hoy) por rendimiento y para que
// funcionen sin internet. Solo las señales NUEVAS que se agreguen desde el
// panel administrativo (con su propia imagen subida a Supabase Storage) se
// muestran usando esa imagen remota.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ImageSourcePropType } from "react-native";
import { supabase, publicImageUrl } from "./supabase";
import { Question, QuestionBank } from "../types";
import {
  Sign,
  SignCategoryInfo,
  SIGNS as BUNDLED_SIGNS,
  SIGN_CATEGORIES as BUNDLED_SIGN_CATEGORIES,
} from "../data/senalesTransito";
import { TituloRef, CODIGO_TRANSITO_TITULOS as BUNDLED_CODIGO_TITULOS } from "../data/codigoTransito";
import bankData from "../data/questions.json";

const BUNDLED_BANK = bankData as QuestionBank;

const CACHE_KEYS = {
  questions: "@autoalianza/cache/questions_v1",
  signs: "@autoalianza/cache/signs_v1",
  codigo: "@autoalianza/cache/codigo_v1",
  horarios: "@autoalianza/cache/horarios_v1",
};

// ---------- forma de las filas tal como las devuelve Supabase ----------
interface RemoteQuestionRow {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  source: string | null;
  is_free: boolean | null;
}
interface RemoteSignCategoryRow {
  key: string;
  label: string;
  short_label: string;
  description: string;
  accent_color: string;
}
interface RemoteSignRow {
  code: string;
  category: string;
  name: string;
  meaning: string | null;
  image_path: string;
}
interface RemoteTituloRow {
  id: string;
  numero: string;
  nombre: string;
}
interface RemoteCapituloRow {
  id: string;
  titulo_id: string;
  numero: string;
  nombre: string;
}
interface RemoteArticuloRow {
  id: string;
  capitulo_id: string;
  numero: string;
  encabezado: string;
  texto: string;
  notas: string[] | null;
}
// Horario de una clase de Teoría o Taller. A diferencia de preguntas/señales/
// código, no hay "banco empacado" de horarios (no tendría sentido: son datos
// que el admin captura semana a semana desde el panel), así que el valor por
// defecto cuando no hay caché ni conexión es simplemente una lista vacía.
export interface HorarioClase {
  id: string;
  fecha: string; // 'YYYY-MM-DD'
  horaInicio: string; // 'HH:MM'
  horaFin: string; // 'HH:MM'
  tipo: "teoria" | "taller";
  instructor: string | null;
  lugar: string | null;
}
interface RemoteHorarioRow {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  tipo: "teoria" | "taller";
  instructor: string | null;
  lugar: string | null;
}

interface SignsCachePayload {
  categories: RemoteSignCategoryRow[];
  signs: RemoteSignRow[];
}
interface CodigoCachePayload {
  titulos: RemoteTituloRow[];
  capitulos: RemoteCapituloRow[];
  articulos: RemoteArticuloRow[];
}

// ---------- transformaciones: filas remotas -> formas que ya usa la app ----------
function toQuestionBank(rows: RemoteQuestionRow[]): QuestionBank {
  return {
    // version / examCategoryLabel / categoryLabels se conservan del banco
    // empacado: son metadatos de la app, no contenido editable en el panel.
    ...BUNDLED_BANK,
    questions: rows.map(
      (r): Question => ({
        id: r.id,
        category: r.category as Question["category"],
        difficulty: r.difficulty as Question["difficulty"],
        question: r.question,
        options: r.options,
        correctIndex: r.correct_index,
        explanation: r.explanation ?? undefined,
        source: r.source ?? undefined,
        isFree: r.is_free ?? undefined,
      })
    ),
  };
}

const BUNDLED_IMAGE_BY_CODE: Record<string, ImageSourcePropType> = {};
BUNDLED_SIGNS.forEach((s) => {
  BUNDLED_IMAGE_BY_CODE[s.code] = s.image;
});

function toSignsData(
  categories: RemoteSignCategoryRow[],
  signs: RemoteSignRow[]
): { categories: SignCategoryInfo[]; signs: Sign[] } {
  if (categories.length === 0 || signs.length === 0) {
    return { categories: BUNDLED_SIGN_CATEGORIES, signs: BUNDLED_SIGNS };
  }
  return {
    categories: categories.map((c) => ({
      key: c.key as SignCategoryInfo["key"],
      label: c.label,
      shortLabel: c.short_label,
      description: c.description,
      accentColor: c.accent_color,
    })),
    signs: signs.map((row) => {
      // Señales que ya existían: se conserva la imagen empacada en el build
      // (más rápida y funciona sin internet). Señales nuevas creadas desde
      // el panel: se usa la imagen subida a Supabase Storage.
      const localImage = BUNDLED_IMAGE_BY_CODE[row.code];
      const image: ImageSourcePropType = localImage ?? { uri: publicImageUrl(row.image_path) };
      return {
        code: row.code,
        category: row.category as Sign["category"],
        name: row.name,
        meaning: row.meaning ?? undefined,
        image,
      };
    }),
  };
}

function toHorarios(rows: RemoteHorarioRow[]): HorarioClase[] {
  return rows.map((r) => ({
    id: r.id,
    fecha: r.fecha,
    horaInicio: (r.hora_inicio || "").slice(0, 5),
    horaFin: (r.hora_fin || "").slice(0, 5),
    tipo: r.tipo,
    instructor: r.instructor,
    lugar: r.lugar,
  }));
}

function toCodigoTitulos(
  titulos: RemoteTituloRow[],
  capitulos: RemoteCapituloRow[],
  articulos: RemoteArticuloRow[]
): TituloRef[] {
  if (titulos.length === 0) return BUNDLED_CODIGO_TITULOS;
  return titulos.map((tit) => ({
    numero: tit.numero,
    nombre: tit.nombre,
    capitulos: capitulos
      .filter((c) => c.titulo_id === tit.id)
      .map((cap) => ({
        numero: cap.numero,
        nombre: cap.nombre,
        articulos: articulos
          .filter((a) => a.capitulo_id === cap.id)
          .map((a) => ({
            numero: a.numero,
            encabezado: a.encabezado,
            notas: a.notas || [],
            texto: a.texto,
          })),
      })),
  }));
}

// ---------- caché local (AsyncStorage) ----------
async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Si no se pudo escribir en caché no pasa nada grave: simplemente la
    // próxima vez se parte del contenido empacado en vez de la última copia
    // sincronizada.
  }
}

// ---------- API pública ----------
export interface LoadedContent {
  questionBank: QuestionBank;
  signCategories: SignCategoryInfo[];
  signs: Sign[];
  codigoTitulos: TituloRef[];
  horarios: HorarioClase[];
}

export function getBundledContent(): LoadedContent {
  return {
    questionBank: BUNDLED_BANK,
    signCategories: BUNDLED_SIGN_CATEGORIES,
    signs: BUNDLED_SIGNS,
    codigoTitulos: BUNDLED_CODIGO_TITULOS,
    horarios: [],
  };
}

export async function loadCachedContent(): Promise<Partial<LoadedContent>> {
  const [qRows, signsPayload, codigoPayload, horarioRows] = await Promise.all([
    readCache<RemoteQuestionRow[]>(CACHE_KEYS.questions),
    readCache<SignsCachePayload>(CACHE_KEYS.signs),
    readCache<CodigoCachePayload>(CACHE_KEYS.codigo),
    readCache<RemoteHorarioRow[]>(CACHE_KEYS.horarios),
  ]);

  const result: Partial<LoadedContent> = {};
  if (qRows) result.questionBank = toQuestionBank(qRows);
  if (signsPayload) {
    const merged = toSignsData(signsPayload.categories, signsPayload.signs);
    result.signCategories = merged.categories;
    result.signs = merged.signs;
  }
  if (codigoPayload) {
    result.codigoTitulos = toCodigoTitulos(codigoPayload.titulos, codigoPayload.capitulos, codigoPayload.articulos);
  }
  if (horarioRows) result.horarios = toHorarios(horarioRows);
  return result;
}

export async function fetchAndCacheContent(): Promise<LoadedContent> {
  // Los horarios solo muestran clases de hoy en adelante: el admin agrega la
  // semana entrante manualmente y no hace falta traer/guardar en caché
  // fechas que ya pasaron.
  const todayIso = new Date().toISOString().slice(0, 10);
  const [qRes, catRes, signRes, tRes, cRes, aRes, hRes] = await Promise.all([
    supabase.from("questions").select("*").order("sort_order"),
    supabase.from("sign_categories").select("*").order("sort_order"),
    supabase.from("signs").select("*").order("sort_order"),
    supabase.from("codigo_titulos").select("*").order("sort_order"),
    supabase.from("codigo_capitulos").select("*").order("sort_order"),
    supabase.from("codigo_articulos").select("*").order("sort_order"),
    supabase
      .from("horarios_clases")
      .select("*")
      .gte("fecha", todayIso)
      .order("fecha")
      .order("hora_inicio"),
  ]);

  const firstError = [qRes, catRes, signRes, tRes, cRes, aRes, hRes].find((r) => r.error)?.error;
  if (firstError) throw firstError;

  const qRows = (qRes.data || []) as RemoteQuestionRow[];
  const catRows = (catRes.data || []) as RemoteSignCategoryRow[];
  const signRows = (signRes.data || []) as RemoteSignRow[];
  const tRows = (tRes.data || []) as RemoteTituloRow[];
  const cRows = (cRes.data || []) as RemoteCapituloRow[];
  const aRows = (aRes.data || []) as RemoteArticuloRow[];
  const hRows = (hRes.data || []) as RemoteHorarioRow[];

  await Promise.all([
    writeCache(CACHE_KEYS.questions, qRows),
    writeCache(CACHE_KEYS.signs, { categories: catRows, signs: signRows } as SignsCachePayload),
    writeCache(CACHE_KEYS.codigo, { titulos: tRows, capitulos: cRows, articulos: aRows } as CodigoCachePayload),
    writeCache(CACHE_KEYS.horarios, hRows),
  ]);

  const signsData = toSignsData(catRows, signRows);
  return {
    questionBank: toQuestionBank(qRows),
    signCategories: signsData.categories,
    signs: signsData.signs,
    codigoTitulos: toCodigoTitulos(tRows, cRows, aRows),
    horarios: toHorarios(hRows),
  };
}
