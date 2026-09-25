# AUTOALIANZA - ET

App móvil (Expo / React Native) para el simulador del examen teórico de
conducción de AUTOALIANZA - Centro de Enseñanza Automovilística, más el panel
administrativo web con el que se gestiona todo el contenido desde Supabase.

## Stack

- **App móvil**: Expo (React Native 0.86, React 19), TypeScript.
- **Backend/contenido**: Supabase (Postgres + Storage), proyecto `lbaussfsyyweagsuvasn`.
- **Panel administrativo**: HTML/CSS/JS plano (sin framework ni build step), en `supabase/admin-panel/`.
- **Compras**: RevenueCat (`react-native-purchases`).
- **Builds/distribución**: EAS (Expo Application Services).

## Estructura del proyecto

```
App.tsx                  Enrutador principal de pantallas (sin react-navigation,
                          es un switch simple sobre un estado "screen")
index.ts                 Entry point de Expo

src/
  screens/                Una pantalla por archivo (Home, Practice, Exam,
                           Results, Paywall, CodigoTransito, SenalesTransito,
                           Manuales, Horarios)
  components/             Piezas reutilizables (QuestionCard, ThemeToggle, ...)
  context/
    ThemeContext.tsx       Modo claro/oscuro, persistido en AsyncStorage
    ContentContext.tsx     Sincronización de contenido con Supabase (ver abajo)
  lib/
    supabase.ts             Cliente de Supabase (URL/anon key públicas por diseño)
    content.ts               Fetch + caché + fallback de todo el contenido
    purchases.ts             Integración con RevenueCat
    storage.ts, screenCapture.ts
  data/                    Contenido EMPACADO en el build (respaldo offline):
                           questions.json, senalesTransito.ts, codigoTransito.ts
  theme.ts                 Paleta de colores de marca (modo claro/oscuro)
  types.ts

supabase/
  schema.sql               Esquema completo de la base de datos (referencia;
                           la fuente de verdad vive en el proyecto de Supabase)
  admin-panel/              Panel web para administrar preguntas, señales,
                           código de tránsito y horarios de clases

local-builds/             Copias locales de .aab/.ipa descargados de EAS
                           (no se suben a git)
secrets/                  Llaves/credenciales (App Store Connect, etc.)
                           (no se suben a git)
```

## Cómo funciona el contenido (importante)

La app **no trae el contenido "quemado" para siempre**: arranca de inmediato
con lo que viene empacado en el build (`src/data/*`, cero espera, funciona
sin internet), y en segundo plano intenta sincronizar con Supabase
(`src/lib/content.ts` + `src/context/ContentContext.tsx`). Si lo logra,
actualiza lo que se ve en pantalla y lo guarda en caché (AsyncStorage) para
la próxima vez. Si falla (sin internet, etc.), sigue funcionando con lo que
ya tenía.

Esto aplica a: preguntas, señales de tránsito, código de tránsito y
horarios de clases. **Todo lo que se edita desde el panel administrativo
aparece en la app sin necesidad de un build nuevo** — la única excepción es
si cambias código (una pantalla, una regla de negocio, etc.), ahí sí hace
falta un build nuevo.

## Desarrollo local

```bash
npm install
npx expo start
```

Abre el proyecto en Expo Go o en un build de desarrollo desde el QR que
aparece en la terminal.

## Panel administrativo

`supabase/admin-panel/` es un sitio estático (sin build step): ábrelo
directamente (`index.html`) o sírvelo con cualquier servidor estático. Pide
login con una cuenta que esté en la tabla `admins` de Supabase — solo esas
cuentas pueden escribir contenido (las políticas RLS de la base de datos son
las que realmente protegen los datos, no la URL ni la llave, que son
públicas por diseño).

Pestañas: Preguntas · Señales · Código de Tránsito · Horarios.

## Base de datos (Supabase)

- Proyecto: `lbaussfsyyweagsuvasn`
- `supabase/schema.sql` documenta el esquema completo (tablas, RLS, triggers
  de sincronización vía `content_meta`). Trátalo como referencia/histórico:
  los cambios reales se aplican directo sobre el proyecto de Supabase.
- Todas las tablas de contenido son de lectura pública (RLS) y escritura
  solo para admins — así protegemos los datos sin tener que ocultar la
  anon key.

## Builds y publicación (EAS)

Perfiles definidos en `eas.json`:

- `development` — cliente de desarrollo, interno
- `preview` — APK interno para probar
- `simulator` — build para simulador de iOS
- `production` — build de tienda (auto-incrementa versión)

```bash
eas build --profile preview --platform android    # probar rápido
eas build --profile production --platform android # subir a Play Console
eas submit --platform android                      # enviar a Play Console
```

La versión de la app vive en `app.json` (`expo.version`); Android/iOS
manejan su propio versionCode/buildNumber vía EAS (`autoIncrement`).

## Control de versiones

```bash
git add -A
git commit -m "descripción del cambio"
git push
```

Repositorio: https://github.com/yeidermejia98-arch/autoalianza-et-android
(privado). `local-builds/` y `secrets/` están excluidos de git a propósito
— revisa `.gitignore` antes de forzar un `git add` de algo que no debería
subirse.
