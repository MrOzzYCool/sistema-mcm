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
