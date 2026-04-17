"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
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

  // 2. Buscar en profiles con retry
  try {
    // Intentar leer el profile — si falla por RLS, reintentar una vez después de un breve delay
    let profile = null;
    let profileErr = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await supabase
        .from("profiles")
        .select("nombre_completo, rol, estado")
        .eq("id", su.id)
        .single();

      profile = result.data;
      profileErr = result.error;

      if (profile || (profileErr && profileErr.code !== "PGRST116")) break;
      // PGRST116 = "no rows returned" — might be timing issue, wait and retry
      if (attempt === 0) await new Promise(r => setTimeout(r, 500));
    }

    if (profileErr && !profile) {
      console.warn("resolveUser: Error leyendo profile:", profileErr.message);
    }

    // 3. Si no existe perfil, crearlo automáticamente
    if (!profile) {
      const nombre = su.user_metadata?.full_name ?? email.split("@")[0];
      try {
        const { data: newProfile } = await supabase.from("profiles").upsert({
          id:              su.id,
          nombre_completo: nombre,
          rol:             "alumno",
          estado:          "activo",
        }, { onConflict: "id" }).select().single();

        if (newProfile) {
          const initials = newProfile.nombre_completo.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
          return { id: su.id, email, name: newProfile.nombre_completo, role: newProfile.rol as AppRole, avatar: initials };
        }
      } catch (insertErr) {
        console.warn("resolveUser: Error creando profile:", insertErr);
      }

      const initials = nombre.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
      return { id: su.id, email, name: nombre, role: "alumno", avatar: initials };
    }

    const name     = profile.nombre_completo ?? email.split("@")[0];
    const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    const role     = (profile.rol as AppRole) ?? "alumno";

    return { id: su.id, email, name, role, avatar: initials };
  } catch (err) {
    console.error("resolveUser: Fallback por error:", err);
    const name = su.user_metadata?.full_name ?? email.split("@")[0];
    const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    return { id: su.id, email, name, role: "alumno", avatar: initials };
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const resolving = useRef(false);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        resolving.current = true;
        try {
          const appUser = await resolveUser(session.user);
          setUser(appUser);
        } finally {
          resolving.current = false;
        }
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip if we're already resolving (avoid double-processing)
        if (resolving.current) return;

        if (event === "SIGNED_OUT") {
          setUser(null);
          setLoading(false);
          return;
        }

        // TOKEN_REFRESHED: silently update user without loading screen
        // This happens when the user returns to the tab after inactivity
        if (event === "TOKEN_REFRESHED" && session?.user) {
          // Don't show loading — just refresh user data quietly
          resolving.current = true;
          try {
            const appUser = await resolveUser(session.user);
            setUser(appUser);
          } finally {
            resolving.current = false;
          }
          return;
        }

        // SIGNED_IN or INITIAL_SESSION: show loading while resolving
        if (session?.user) {
          setLoading(true);
          resolving.current = true;
          try {
            const appUser = await resolveUser(session.user);
            setUser(appUser);
          } finally {
            resolving.current = false;
            setLoading(false);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      // onAuthStateChange will handle setting the user
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }

  async function logout() {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setLoading(false);
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
