"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// ─── Roles hardcodeados (admins) — alumnos se leen de profiles ───────────────

type AppRole = "super_admin" | "staff_tramites" | "gestor" | "actualizacion" | "profesor" | "alumno";

const ADMIN_ROLES: Record<string, AppRole> = {
  "admin@margaritacabrera.edu.pe":      "super_admin",
  "staff@margaritacabrera.edu.pe":      "staff_tramites",
  "nvasquez@margaritacabrera.edu.pe":   "gestor",
  "milnarvaez@margaritacabrera.edu.pe": "actualizacion",
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  avatar: string;
}

interface AuthCtx {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

// ─── Resolver rol: primero ADMIN_ROLES, luego profiles, fallback alumno ──────

async function resolveUser(su: SupabaseUser): Promise<AppUser> {
  const email    = su.email ?? "";
  const emailLow = email.toLowerCase();

  // 1. Admins hardcodeados — no necesitan profiles
  const adminRole = ADMIN_ROLES[emailLow];
  if (adminRole) {
    const name     = su.user_metadata?.full_name ?? email.split("@")[0];
    const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    return { id: su.id, email, name, role: adminRole, avatar: initials };
  }

  // 2. Buscar en profiles (con timeout para evitar que se quede colgado)
  try {
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("nombre_completo, rol, estado")
      .eq("id", su.id)
      .single();

    if (profileErr) {
      console.warn("Error leyendo profile:", profileErr.message);
    }

    // 3. Si no existe perfil, crearlo automáticamente
    if (!profile) {
      const nombre = su.user_metadata?.full_name ?? email.split("@")[0];
      try {
        await supabase.from("profiles").insert({
          id:              su.id,
          nombre_completo: nombre,
          rol:             "alumno",
          estado:          "activo",
        }).select().single();
      } catch (insertErr) {
        console.warn("Error creando profile automático:", insertErr);
      }

      const initials = nombre.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
      return { id: su.id, email, name: nombre, role: "alumno", avatar: initials };
    }

    const name     = profile.nombre_completo ?? email.split("@")[0];
    const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    const role     = (profile.rol as AppRole) ?? "alumno";

    return { id: su.id, email, name, role, avatar: initials };
  } catch (err) {
    // Fallback: si todo falla, devolver usuario básico para no bloquear el login
    console.error("Error en resolveUser, usando fallback:", err);
    const name = su.user_metadata?.full_name ?? email.split("@")[0];
    const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    return { id: su.id, email, name, role: "alumno", avatar: initials };
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const appUser = await resolveUser(session.user);
        setUser(appUser);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const appUser = await resolveUser(session.user);
          setUser(appUser);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
