// Configuración de conexión a Supabase.
// SUPABASE_URL y SUPABASE_ANON_KEY son públicos por diseño (van en cualquier
// cliente: esta web, y también la app móvil). Lo que protege los datos no es
// ocultar esta clave, sino las políticas de seguridad (RLS) configuradas en
// la base de datos: cualquiera puede LEER, pero solo un usuario que esté en
// la tabla `admins` puede ESCRIBIR (crear, editar o borrar).
export const SUPABASE_URL = "https://lbaussfsyyweagsuvasn.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYXVzc2ZzeXl3ZWFnc3V2YXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NjQ4NTgsImV4cCI6MjEwNDE0MDg1OH0.wF42jd1A60mHyyxVYbklzKthGOq0wikzPuUNdkHfAGk";

// `supabase` (global UMD) es inyectado por el <script> de supabase-js
// cargado en index.html antes de este módulo.
export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

export const SIGNS_BUCKET = "senales";

export function publicImageUrl(imagePath) {
  const { data } = supabase.storage.from(SIGNS_BUCKET).getPublicUrl(imagePath);
  return data.publicUrl;
}
