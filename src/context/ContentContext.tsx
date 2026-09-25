import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { QuestionBank } from "../types";
import { Sign, SignCategoryInfo } from "../data/senalesTransito";
import { TituloRef } from "../data/codigoTransito";
import { getBundledContent, loadCachedContent, fetchAndCacheContent, LoadedContent, HorarioClase } from "../lib/content";

interface ContentContextValue extends LoadedContent {
  refreshing: boolean;
  lastSyncError: string | null;
  refresh: () => Promise<void>;
}

const ContentContext = createContext<ContentContextValue | null>(null);

// Provee a toda la app las preguntas, señales y artículos del Código de
// Tránsito. Arranca de inmediato con el contenido empacado en el build (cero
// espera, cero riesgo de pantalla en blanco), y en segundo plano intenta
// traer lo más reciente desde Supabase — si lo logra, actualiza el contenido
// que ven las pantallas ya abiertas; si no (sin internet, etc.), no cambia
// nada y la app sigue funcionando con lo que ya tenía.
export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<LoadedContent>(() => getBundledContent());
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  async function refresh() {
    setRefreshing(true);
    try {
      const fresh = await fetchAndCacheContent();
      if (mountedRef.current) {
        setContent(fresh);
        setLastSyncError(null);
      }
    } catch (err: any) {
      // No es un error fatal: simplemente seguimos mostrando lo que ya
      // había (caché o contenido empacado). Se registra para poder
      // diagnosticar problemas de conexión si hace falta.
      console.warn(
        "[AUTOALIANZA] No se pudo sincronizar contenido con Supabase, se sigue usando el contenido local/caché.",
        err
      );
      if (mountedRef.current) setLastSyncError(err?.message ?? "Error de sincronización");
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      const cached = await loadCachedContent();
      if (mountedRef.current && Object.keys(cached).length > 0) {
        setContent((prev) => ({ ...prev, ...cached }));
      }
      await refresh();
    })();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ContentContext.Provider value={{ ...content, refreshing, lastSyncError, refresh }}>
      {children}
    </ContentContext.Provider>
  );
}

function useContentContext(): ContentContextValue {
  const ctx = useContext(ContentContext);
  if (!ctx) {
    throw new Error("useContentContext debe usarse dentro de <ContentProvider>");
  }
  return ctx;
}

export function useQuestionBank(): QuestionBank {
  return useContentContext().questionBank;
}

export function useSignsData(): { categories: SignCategoryInfo[]; signs: Sign[] } {
  const { signCategories, signs } = useContentContext();
  return { categories: signCategories, signs };
}

export function useCodigoTitulos(): TituloRef[] {
  return useContentContext().codigoTitulos;
}

export function useHorarios(): HorarioClase[] {
  return useContentContext().horarios;
}

// Por si en el futuro se quiere agregar un botón de "Actualizar contenido"
// en alguna pantalla, o mostrar un aviso si la última sincronización falló.
export function useContentSync(): { refreshing: boolean; lastSyncError: string | null; refresh: () => Promise<void> } {
  const { refreshing, lastSyncError, refresh } = useContentContext();
  return { refreshing, lastSyncError, refresh };
}
