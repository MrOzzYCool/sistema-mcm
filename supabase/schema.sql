-- ─── Tabla principal de solicitudes ──────────────────────────────────────────
create table if not exists public.solicitudes (
  id                  uuid primary key default gen_random_uuid(),
  nombres             text not null,
  apellidos           text not null,
  dni                 text not null,
  email               text not null,
  celular             text not null,
  anio_egreso         text not null,
  tipo_tramite        text not null,
  costo_tramite       numeric(10,2) not null default 0,
  monto_pagado        numeric(10,2) not null default 0,
  voucher_url         text not null,
  dni_anverso_url     text not null,
  dni_reverso_url     text not null,
  estado              text not null default 'pendiente'
                      check (estado in ('pendiente','aprobado','observado','rechazado')),
  observacion         text,
  -- Nuevos campos
  token_subsanacion   text unique default gen_random_uuid()::text,
  observaciones       jsonb,
  pdf_boleta_url      text,
  created_at          timestamptz not null default now()
);

-- Si la tabla ya existe, agrega solo los campos nuevos:
alter table public.solicitudes
  add column if not exists token_subsanacion text unique default gen_random_uuid()::text,
  add column if not exists observaciones     jsonb,
  add column if not exists pdf_boleta_url    text;

-- Índices
create index if not exists idx_solicitudes_estado            on public.solicitudes(estado);
create index if not exists idx_solicitudes_created_at        on public.solicitudes(created_at desc);
create index if not exists idx_solicitudes_dni               on public.solicitudes(dni);
create index if not exists idx_solicitudes_token_subsanacion on public.solicitudes(token_subsanacion);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.solicitudes enable row level security;

create policy "insert_public" on public.solicitudes
  for insert with check (true);

create policy "select_auth" on public.solicitudes
  for select using (auth.role() = 'authenticated');

create policy "update_auth" on public.solicitudes
  for update using (auth.role() = 'authenticated');

-- ─── Storage bucket ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('tramites-mcm', 'tramites-mcm', true)
on conflict (id) do nothing;

create policy "upload_public" on storage.objects
  for insert with check (bucket_id = 'tramites-mcm');

create policy "read_public" on storage.objects
  for select using (bucket_id = 'tramites-mcm');

-- Campos adicionales para Sílabo por Curso
alter table public.solicitudes
  add column if not exists carrera          text,
  add column if not exists cantidad_silabos integer;

-- Campos de comprobante (Boleta / Factura)
alter table public.solicitudes
  add column if not exists tipo_comprobante text check (tipo_comprobante in ('boleta','factura')),
  add column if not exists ruc              text,
  add column if not exists razon_social     text,
  add column if not exists direccion_fiscal text;

-- Campo para distinguir trámites de actualizaciones
alter table public.solicitudes
  add column if not exists tipo_formulario text default 'tramite'
    check (tipo_formulario in ('tramite','actualizacion'));

-- ─── Tabla de perfiles ────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  nombre_completo  text,
  rol              text not null default 'alumno' check (rol in ('alumno','super_admin','staff_tramites','gestor','actualizacion')),
  estado           text not null default 'activo' check (estado in ('activo','inactivo')),
  created_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cualquier usuario autenticado puede leer su propio perfil
create policy "select_own_profile" on public.profiles
  for select using (auth.uid() = id);

-- Solo el sistema (trigger) puede insertar
create policy "insert_profile" on public.profiles
  for insert with check (true);

-- Solo el propio usuario puede actualizar su perfil
create policy "update_own_profile" on public.profiles
  for update using (auth.uid() = id);

-- ─── Trigger: crear perfil automáticamente al registrar usuario ──────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nombre_completo, rol, estado)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'alumno',
    'activo'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Eliminar trigger si ya existe para evitar error
drop trigger if exists on_auth_user_created on auth.users;

-- Crear trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Actualizar profiles para soportar profesor ───────────────────────────────
alter table public.profiles drop constraint if exists profiles_rol_check;
alter table public.profiles add constraint profiles_rol_check
  check (rol in ('alumno','profesor','super_admin','staff_tramites','gestor','actualizacion'));

alter table public.profiles
  add column if not exists dni        text,
  add column if not exists created_by uuid;

-- ─── Tabla de auditoría ───────────────────────────────────────────────────────
create table if not exists public.historial_auditoria (
  id         uuid primary key default gen_random_uuid(),
  accion     text not null,
  detalle    jsonb,
  admin_id   uuid references auth.users(id),
  admin_email text,
  target_id  uuid,
  created_at timestamptz not null default now()
);

alter table public.historial_auditoria enable row level security;

create policy "select_audit_admin" on public.historial_auditoria
  for select using (auth.role() = 'authenticated');

create policy "insert_audit" on public.historial_auditoria
  for insert with check (true);

-- Permitir admins leer todos los profiles
create policy "select_all_profiles_admin" on public.profiles
  for select using (auth.role() = 'authenticated');

-- Permitir admins actualizar cualquier profile
create policy "update_all_profiles_admin" on public.profiles
  for update using (auth.role() = 'authenticated');

-- ─── Gestión Académica ────────────────────────────────────────────────────────

create table if not exists public.carreras (
  id               uuid primary key default gen_random_uuid(),
  nombre_carrera   text not null,
  codigo           text unique not null,
  duracion_ciclos  integer not null default 6,
  created_at       timestamptz not null default now()
);

create table if not exists public.cursos (
  id                   uuid primary key default gen_random_uuid(),
  nombre_curso         text not null,
  ciclo_perteneciente  integer not null default 1,
  creditos             integer not null default 3,
  created_at           timestamptz not null default now()
);

create table if not exists public.malla_curricular (
  id         uuid primary key default gen_random_uuid(),
  carrera_id uuid not null references public.carreras(id) on delete cascade,
  curso_id   uuid not null references public.cursos(id) on delete cascade,
  unique(carrera_id, curso_id)
);

-- RLS
alter table public.carreras enable row level security;
alter table public.cursos enable row level security;
alter table public.malla_curricular enable row level security;

create policy "read_carreras" on public.carreras for select using (true);
create policy "write_carreras" on public.carreras for all using (auth.role() = 'authenticated');

create policy "read_cursos" on public.cursos for select using (true);
create policy "write_cursos" on public.cursos for all using (auth.role() = 'authenticated');

create policy "read_malla" on public.malla_curricular for select using (true);
create policy "write_malla" on public.malla_curricular for all using (auth.role() = 'authenticated');

-- Campo codigo_interno para cursos (usado en import CSV)
alter table public.cursos
  add column if not exists codigo_interno text unique;

-- ─── Inscripciones de alumnos ─────────────────────────────────────────────────

create table if not exists public.inscripciones (
  id                uuid primary key default gen_random_uuid(),
  alumno_id         uuid not null references auth.users(id) on delete cascade,
  carrera_id        uuid not null references public.carreras(id),
  ciclo_actual      integer not null default 1,
  fecha_inicio_ciclo timestamptz not null default now(),
  estado            text not null default 'activo'
                    check (estado in ('activo','pendiente_promocion','promovido','egresado','inactivo')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(alumno_id, carrera_id)
);

alter table public.inscripciones enable row level security;
create policy "read_inscripciones" on public.inscripciones for select using (auth.role() = 'authenticated');
create policy "write_inscripciones" on public.inscripciones for all using (auth.role() = 'authenticated');

-- ─── Historial de ciclos ──────────────────────────────────────────────────────

create table if not exists public.historial_ciclos (
  id          uuid primary key default gen_random_uuid(),
  alumno_id   uuid not null references auth.users(id) on delete cascade,
  carrera_id  uuid not null references public.carreras(id),
  ciclo       integer not null,
  fecha_inicio timestamptz not null,
  fecha_fin   timestamptz,
  estado      text not null default 'activo'
              check (estado in ('activo','completado','egresado')),
  observacion text,
  created_at  timestamptz not null default now()
);

alter table public.historial_ciclos enable row level security;
create policy "read_historial_ciclos" on public.historial_ciclos for select using (auth.role() = 'authenticated');
create policy "write_historial_ciclos" on public.historial_ciclos for all using (auth.role() = 'authenticated');

-- ─── Ajustes de seguridad para inscripciones y historial ──────────────────────

-- Cambiar FK a profiles en vez de auth.users (si las tablas ya existen)
-- Si acabas de crear las tablas, ignora estos ALTER
-- alter table public.inscripciones drop constraint if exists inscripciones_alumno_id_fkey;
-- alter table public.inscripciones add constraint inscripciones_alumno_id_fkey foreign key (alumno_id) references public.profiles(id) on delete cascade;
-- alter table public.historial_ciclos drop constraint if exists historial_ciclos_alumno_id_fkey;
-- alter table public.historial_ciclos add constraint historial_ciclos_alumno_id_fkey foreign key (alumno_id) references public.profiles(id) on delete cascade;

-- RLS restrictivo: alumno solo lee su propia info
drop policy if exists "rw_inscripciones" on public.inscripciones;
drop policy if exists "read_inscripciones" on public.inscripciones;
drop policy if exists "write_inscripciones" on public.inscripciones;

create policy "alumno_read_own_inscripcion" on public.inscripciones
  for select using (auth.uid() = alumno_id);

create policy "admin_all_inscripciones" on public.inscripciones
  for all using (auth.role() = 'authenticated' and exists (
    select 1 from public.profiles where id = auth.uid() and rol in ('super_admin')
  ));

drop policy if exists "rw_historial_ciclos" on public.historial_ciclos;
drop policy if exists "read_historial_ciclos" on public.historial_ciclos;
drop policy if exists "write_historial_ciclos" on public.historial_ciclos;

create policy "alumno_read_own_historial" on public.historial_ciclos
  for select using (auth.uid() = alumno_id);

create policy "admin_all_historial_ciclos" on public.historial_ciclos
  for all using (auth.role() = 'authenticated' and exists (
    select 1 from public.profiles where id = auth.uid() and rol in ('super_admin')
  ));

-- Trigger para updated_at en inscripciones
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_inscripciones_updated_at on public.inscripciones;
create trigger set_inscripciones_updated_at
  before update on public.inscripciones
  for each row execute function public.set_updated_at();

-- ─── Cursos asignados a cada alumno ───────────────────────────────────────────

create table if not exists public.alumno_cursos (
  id          uuid primary key default gen_random_uuid(),
  alumno_id   uuid not null references public.profiles(id) on delete cascade,
  carrera_id  uuid not null references public.carreras(id),
  ciclo       integer not null,
  curso_id    uuid not null references public.cursos(id),
  estado      text not null default 'en_curso'
              check (estado in ('en_curso','aprobado','desaprobado','retirado')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(alumno_id, curso_id, ciclo)
);

alter table public.alumno_cursos enable row level security;

create policy "alumno_read_own_cursos" on public.alumno_cursos
  for select using (auth.uid() = alumno_id);

create policy "admin_all_alumno_cursos" on public.alumno_cursos
  for all using (auth.role() = 'authenticated' and exists (
    select 1 from public.profiles where id = auth.uid() and rol in ('super_admin')
  ));

drop trigger if exists set_alumno_cursos_updated_at on public.alumno_cursos;
create trigger set_alumno_cursos_updated_at
  before update on public.alumno_cursos
  for each row execute function public.set_updated_at();
