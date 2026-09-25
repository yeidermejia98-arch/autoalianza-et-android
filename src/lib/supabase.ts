import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Mismo proyecto de Supabase que usa el panel administrativo web
// (adminautoalianza-et.netlify.app). La URL y la llave "anon" son públicas
// por diseño — igual que en el panel — porque lo que protege los datos son
// las políticas de RLS configuradas en la base de datos (lectura pública,
// escritura solo para administradores), no mantener esta llave en secreto.
export const SUPABASE_URL = "https://lbaussfsyyweagsuvasn.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYXVzc2ZzeXl3ZWFnc3V2YXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NjQ4NTgsImV4cCI6MjEwNDE0MDg1OH0.wF42jd1A60mHyyxVYbklzKthGOq0wikzPuUNdkHfAGk";

export const SIGNS_BUCKET = "senales";

// La app nunca inicia sesión (no hay login de usuarios finales, solo lectura
// pública), así que desactivamos todo el manejo de sesión/tokens de auth
// para evitar trabajo y advertencias innecesarias en segundo plano.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

export function publicImageUrl(imagePath: string): string {
  const { data } = supabase.storage.from(SIGNS_BUCKET).getPublicUrl(imagePath);
  return data.publicUrl;
}
