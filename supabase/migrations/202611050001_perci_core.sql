-- PERCÍ 1.0 / FASE B PASO 2
-- Modelo multiusuario inicial. Aplicar SOLO en proyecto de desarrollo Supabase.
-- Cero datos locales son enviados o migrados por este script.
-- Se requiere Supabase Auth y Postgres (gen_random_uuid disponible en Postgres moderno).

create table public.perci_profiles (
    user_id uuid primary key references auth.users (id) on delete cascade,
    theme text not null default 'dark' check (theme in ('dark','light','system')),
    focus text not null default 'both' check (focus in ('gym','others','both')),
    timezone text not null default 'America/Argentina/Buenos_Aires',
    onboarding_done boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.perci_routines (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    client_id text not null check (length(client_id) between 1 and 120),
    name text not null check (length(btrim(name)) between 1 and 80),
    detail text not null default '' check (length(detail) <= 500),
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, id),
    unique (user_id, client_id)
);

create table public.perci_routine_exercises (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    routine_id uuid not null,
    client_id text not null check (length(client_id) between 1 and 120),
    position integer not null check (position >= 0),
    name text not null check (length(btrim(name)) between 1 and 80),
    target_sets integer not null check (target_sets between 1 and 15),
    target_reps integer not null check (target_reps between 1 and 100),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, id),
    unique (user_id, client_id),
    unique (routine_id, position),
    foreign key (user_id, routine_id)
      references public.perci_routines (user_id, id) on delete cascade
);

-- Historial común. Las sesiones de fuerza se distinguen por activity_type = 'gym'.
-- El histórico v0.4 solo almacena el resumen de series, no sus detalles originales.
create table public.perci_activity_records (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    client_id text not null check (length(client_id) between 1 and 120),
    routine_id uuid,
    activity_type text not null check (activity_type in ('gym','walk','run','cycle','sport','other')),
    name text not null check (length(btrim(name)) between 1 and 80),
    activity_date date not null,
    minutes integer not null check (minutes between 1 and 1440),
    distance_km numeric(10,3) check (distance_km is null or distance_km between 0 and 1000),
    sets_done integer check (sets_done is null or sets_done >= 0),
    volume_kg numeric(14,2) check (volume_kg is null or volume_kg >= 0),
    note text not null default '' check (length(note) <= 400),
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, id),
    unique (user_id, client_id),
    foreign key (user_id, routine_id)
      references public.perci_routines (user_id, id) on delete set null (routine_id)
);

create table public.perci_workout_sets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    record_id uuid not null,
    exercise_position integer not null check (exercise_position >= 0),
    exercise_name text not null check (length(btrim(exercise_name)) between 1 and 80),
    set_number integer not null check (set_number between 1 and 15),
    reps integer not null check (reps between 0 and 100),
    weight_kg numeric(9,2) not null default 0 check (weight_kg >= 0),
    completed boolean not null default true,
    created_at timestamptz not null default now(),
    unique (record_id, exercise_position, set_number),
    foreign key (user_id, record_id)
      references public.perci_activity_records (user_id, id) on delete cascade
);

create table public.perci_habits (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    client_id text not null check (length(client_id) between 1 and 120),
    name text not null check (length(btrim(name)) between 1 and 70),
    days integer[] not null default '{1,2,3,4,5}'::integer[]
      check (array_length(days, 1) between 1 and 7 and days <@ array[0,1,2,3,4,5,6]),
    paused boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, id),
    unique (user_id, client_id)
);

create table public.perci_habit_checks (
    user_id uuid not null references auth.users (id) on delete cascade,
    habit_id uuid not null,
    check_date date not null,
    completed boolean not null default true,
    created_at timestamptz not null default now(),
    primary key (user_id, habit_id, check_date),
    foreign key (user_id, habit_id)
      references public.perci_habits (user_id, id) on delete cascade
);

-- Borrador de una sola sesión por usuario. Sólo se sincronizará en una fase futura.
create table public.perci_workout_drafts (
    user_id uuid primary key references auth.users (id) on delete cascade,
    client_id text not null check (length(client_id) between 1 and 120),
    routine_id uuid,
    snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(snapshot) = 'array'),
    sets_data jsonb not null default '{}'::jsonb check (jsonb_typeof(sets_data) = 'object'),
    started_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    foreign key (user_id, routine_id)
      references public.perci_routines (user_id, id) on delete set null (routine_id)
);

-- Todas las tablas contienen user_id para simplificar RLS y auditar propietario.
create index perci_routines_owner_idx on public.perci_routines (user_id);
create index perci_routine_exercises_owner_idx on public.perci_routine_exercises (user_id);
create index perci_activity_records_owner_date_idx on public.perci_activity_records (user_id, activity_date desc);
create index perci_workout_sets_owner_idx on public.perci_workout_sets (user_id);
create index perci_habits_owner_idx on public.perci_habits (user_id);
create index perci_habit_checks_owner_date_idx on public.perci_habit_checks (user_id, check_date desc);
-- perci_profiles y perci_workout_drafts indexan user_id por PK.

create function public.perci_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
    new.updated_at = now();
    return new;
end;
$$;
revoke all on function public.perci_touch_updated_at() from public, anon, authenticated;

create trigger touch_perci_profiles before update on public.perci_profiles
  for each row execute function public.perci_touch_updated_at();
create trigger touch_perci_routines before update on public.perci_routines
  for each row execute function public.perci_touch_updated_at();
create trigger touch_perci_routine_exercises before update on public.perci_routine_exercises
  for each row execute function public.perci_touch_updated_at();
create trigger touch_perci_activity_records before update on public.perci_activity_records
  for each row execute function public.perci_touch_updated_at();
create trigger touch_perci_habits before update on public.perci_habits
  for each row execute function public.perci_touch_updated_at();
create trigger touch_perci_workout_drafts before update on public.perci_workout_drafts
  for each row execute function public.perci_touch_updated_at();

-- Row Level Security + mínimo privilegio. Anon no obtiene acceso.
alter table public.perci_profiles enable row level security;
alter table public.perci_routines enable row level security;
alter table public.perci_routine_exercises enable row level security;
alter table public.perci_activity_records enable row level security;
alter table public.perci_workout_sets enable row level security;
alter table public.perci_habits enable row level security;
alter table public.perci_habit_checks enable row level security;
alter table public.perci_workout_drafts enable row level security;

revoke all on table
  public.perci_profiles, public.perci_routines, public.perci_routine_exercises,
  public.perci_activity_records, public.perci_workout_sets, public.perci_habits,
  public.perci_habit_checks, public.perci_workout_drafts
from public, anon, authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.perci_profiles, public.perci_routines, public.perci_routine_exercises,
  public.perci_activity_records, public.perci_workout_sets, public.perci_habits,
  public.perci_habit_checks, public.perci_workout_drafts
  to authenticated;

-- Políticas independientes por operación, todas las tablas propiedad del usuario.
DO $$
declare t text;
begin
  foreach t in array array[
    'perci_profiles','perci_routines','perci_routine_exercises',
    'perci_activity_records','perci_workout_sets','perci_habits',
    'perci_habit_checks','perci_workout_drafts'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_read_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end;
$$;

-- No se crea trigger de auth.users: el perfil se crea luego del login en el siguiente paso.
-- No se crea API de subida: nada se envía desde el navegador en v0.6.
