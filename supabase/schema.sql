-- =====================================================================
-- AUTOALIANZA - ET — Esquema Supabase (Postgres)
-- Preguntas · Señales de tránsito · Código Nacional de Tránsito
-- =====================================================================
-- Diseñado a partir de:
--   - questions.json      (136 preguntas reales, 6 categorías)
--   - senalesTransito.ts  (218 señales reales, 4 categorías)
--   - codigoTransito.ts   (Ley 769/2002 actualizada: 176 artículos,
--                          jerarquía Título > Capítulo > Artículo)
--
-- Todas las tablas quedan con RLS activado: lectura pública (la app la
-- consulta con la "anon key", que va empacada en el build y es normal
-- que sea pública), escritura solo para usuarios que estén en la tabla
-- `admins` (es decir, solo tú, autenticado en el panel administrativo).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Administradores del panel
-- ---------------------------------------------------------------------
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;

-- Función auxiliar: ¿el usuario autenticado actual es admin?
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create policy "admins: solo el propio admin se ve a sí mismo"
  on admins for select
  using (auth.uid() = user_id);

-- =====================================================================
-- 1. PREGUNTAS
-- =====================================================================

create table question_categories (
  key   text primary key,        -- ej. 'marco_legal'
  label text not null,           -- ej. 'Marco Legal'
  sort_order int not null default 0
);

create table questions (
  id            text primary key,                 -- ej. 'q001'
  category      text not null references question_categories(key),
  difficulty    text not null check (difficulty in ('baja','media','alta')),
  question      text not null,
  options       text[] not null check (array_length(options, 1) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation   text,
  source        text,                              -- cita, ej. '1.1 Autoridades de tránsito'
  is_free       boolean not null default false,
  sort_order    int not null default 0,
  updated_at    timestamptz not null default now()
);

create index on questions (category);

alter table question_categories enable row level security;
alter table questions enable row level security;

create policy "lectura pública" on question_categories for select using (true);
create policy "lectura pública" on questions for select using (true);
create policy "solo admin escribe" on question_categories for all
  using (is_admin()) with check (is_admin());
create policy "solo admin escribe" on questions for all
  using (is_admin()) with check (is_admin());

-- =====================================================================
-- 2. SEÑALES DE TRÁNSITO
-- =====================================================================

create table sign_categories (
  key          text primary key,   -- 'SR' | 'SP' | 'SI' | 'ST'
  label        text not null,
  short_label  text not null,
  description  text not null,
  accent_color text not null,
  sort_order   int not null default 0
);

create table signs (
  code        text primary key,    -- ej. 'SR-01'
  category    text not null references sign_categories(key),
  name        text not null,
  meaning     text,                -- opcional (no todas las señales lo tienen)
  image_path  text not null,       -- ruta dentro del bucket 'senales', ej. 'SR/SR-01.png'
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);

create index on signs (category);

alter table sign_categories enable row level security;
alter table signs enable row level security;

create policy "lectura pública" on sign_categories for select using (true);
create policy "lectura pública" on signs for select using (true);
create policy "solo admin escribe" on sign_categories for all
  using (is_admin()) with check (is_admin());
create policy "solo admin escribe" on signs for all
  using (is_admin()) with check (is_admin());

-- Bucket de Storage para las imágenes de señales (público de solo lectura)
insert into storage.buckets (id, name, public)
values ('senales', 'senales', true)
on conflict (id) do nothing;

create policy "senales: lectura pública"
  on storage.objects for select
  using (bucket_id = 'senales');

create policy "senales: solo admin sube/edita/borra"
  on storage.objects for all
  using (bucket_id = 'senales' and is_admin())
  with check (bucket_id = 'senales' and is_admin());

-- =====================================================================
-- 3. CÓDIGO NACIONAL DE TRÁNSITO (Título > Capítulo > Artículo)
-- =====================================================================

create table codigo_titulos (
  id         uuid primary key default gen_random_uuid(),
  numero     text not null,      -- ej. 'I' (numeración romana del texto oficial)
  nombre     text not null,
  sort_order int not null default 0
);

create table codigo_capitulos (
  id         uuid primary key default gen_random_uuid(),
  titulo_id  uuid not null references codigo_titulos(id) on delete cascade,
  numero     text not null,
  nombre     text not null,
  sort_order int not null default 0
);

create table codigo_articulos (
  id           uuid primary key default gen_random_uuid(),
  capitulo_id  uuid not null references codigo_capitulos(id) on delete cascade,
  numero       text not null,     -- ej. '1' (número del artículo, no romano)
  encabezado   text not null,
  texto        text not null,
  notas        text[] not null default '{}',   -- modificaciones/leyes que lo afectan
  sort_order   int not null default 0,
  updated_at   timestamptz not null default now()
);

create index on codigo_capitulos (titulo_id);
create index on codigo_articulos (capitulo_id);

alter table codigo_titulos enable row level security;
alter table codigo_capitulos enable row level security;
alter table codigo_articulos enable row level security;

create policy "lectura pública" on codigo_titulos for select using (true);
create policy "lectura pública" on codigo_capitulos for select using (true);
create policy "lectura pública" on codigo_articulos for select using (true);
create policy "solo admin escribe" on codigo_titulos for all
  using (is_admin()) with check (is_admin());
create policy "solo admin escribe" on codigo_capitulos for all
  using (is_admin()) with check (is_admin());
create policy "solo admin escribe" on codigo_articulos for all
  using (is_admin()) with check (is_admin());

-- =====================================================================
-- 4. Metadatos de contenido (para que la app sepa si hay algo nuevo)
-- =====================================================================

create table content_meta (
  key          text primary key,     -- 'questions' | 'signs' | 'codigo'
  updated_at   timestamptz not null default now()
);

insert into content_meta (key) values ('questions'), ('signs'), ('codigo');

alter table content_meta enable row level security;
create policy "lectura pública" on content_meta for select using (true);
create policy "solo admin escribe" on content_meta for all
  using (is_admin()) with check (is_admin());

-- Actualiza content_meta automáticamente cuando cambian los datos,
-- así la app solo necesita revisar 3 fechas (livianas) para saber si
-- debe volver a descargar el banco de preguntas, las señales o el código.
create or replace function touch_content_meta(content_key text)
returns trigger language plpgsql as $$
begin
  update content_meta set updated_at = now() where key = content_key;
  return null;
end;
$$;

create trigger trg_questions_touch
  after insert or update or delete on questions
  for each statement execute function touch_content_meta('questions');

create trigger trg_signs_touch
  after insert or update or delete on signs
  for each statement execute function touch_content_meta('signs');

create trigger trg_codigo_articulos_touch
  after insert or update or delete on codigo_articulos
  for each statement execute function touch_content_meta('codigo');

-- =====================================================================
-- 5. HORARIOS DE CLASES (Teoría / Taller)
-- =====================================================================
-- Sin sistema de cuentas para aprendices: lectura pública (igual que el
-- resto del contenido), escritura solo admin. El admin agrega manualmente
-- los horarios de la semana desde el panel; la app solo los visualiza.
-- Teoría es abierta a todas las categorías (sin segmentación por grupo).

create table horarios_clases (
  id           uuid primary key default gen_random_uuid(),
  fecha        date not null,
  hora_inicio  time not null,
  hora_fin     time not null,
  tipo         text not null check (tipo in ('teoria', 'taller')),
  instructor   text,
  lugar        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index on horarios_clases (fecha, hora_inicio);

alter table horarios_clases enable row level security;

create policy "lectura publica" on horarios_clases for select using (true);
create policy "solo admin escribe" on horarios_clases for all
  using (is_admin()) with check (is_admin());

insert into content_meta (key) values ('horarios') on conflict (key) do nothing;

create trigger trg_horarios_clases_touch
  after insert or update or delete on horarios_clases
  for each statement execute function touch_content_meta('horarios');

create or replace function set_horarios_clases_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_horarios_clases_set_updated_at
  before update on horarios_clases
  for each row execute function set_horarios_clases_updated_at();
