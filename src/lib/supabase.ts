import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,          // guarda sesión en localStorage automáticamente
    autoRefreshToken: true,        // renueva el token antes de que expire
    detectSessionInUrl: true,      // maneja magic links / OAuth callbacks
  },
  global: {
    fetch: (url, options = {}) =>
      fetch(url, { ...options, cache: "no-store" }),
  },
});

// ─── Tipos de la tabla 'solicitudes' ──────────────────────────────────────────

export interface SolicitudDB {
  id?: string;
  nombres: string;
  apellidos: string;
  dni: string;
  email: string;
  celular: string;
  anio_egreso: string;
  tipo_tramite: string;
  costo_tramite: number;
  monto_pagado: number;
  voucher_url: string;
  dni_anverso_url: string;
  dni_reverso_url: string;
  estado: "pendiente" | "aprobado" | "observado" | "rechazado";
  observacion?: string;
  // Nuevos campos
  token_subsanacion?: string;
  observaciones?: Record<string, string> | null;
  pdf_boleta_url?: string | null;
  // Campos para Sílabo por Curso
  carrera?: string | null;
  cantidad_silabos?: number | null;
  // Campos de comprobante
  tipo_comprobante?: "boleta" | "factura";
  ruc?: string | null;
  razon_social?: string | null;
  direccion_fiscal?: string | null;
  created_at?: string;
}
