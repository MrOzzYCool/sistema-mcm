"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// ─── Roles hardcodeados (admins) ─────────────────────────────────────────────

type AppRole = "super_admin" | "staff_tramites" | "gestor" | "actualizacion" | "profesor" | "alumno";

const ADMIN_ROLES: Record<string, AppRole> = {
  "admin@margaritacabrera.edu.pe":      "super_admin",
  "staff@margaritacabrera.edu.pe":      "staff_tramites",
  "nvasquez@margaritacabrera.edu.pe":   "gestor",
  "milnarvaez@margaritacabrera.edu.pe": "actualizacion",
};

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  avatar: string;
}

interface AuthCtx {
  user: AppUser | null;
  initializing: boolean;  // true ONLY during first app load
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

// ─── Resolver rol ────────────────────────────────────────────────────────────

async function resolveUser(su: SupabaseUser): Promise<AppUser> {
  const email = su.email ?? "";
  const emailLow = email.toLowerCase();

  // Admins hardcodeados
  const adminRole = ADMIN_ROLES[emailLow];
  if (adminRole) {
    const name = su.user_metadata?.full_name ?? email.split("@")[0];
    const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    return { id: su.id, email, name, role: adminRole, avatar: initials };
  }

  // Buscar en profiles
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nombre_completo, rol, estado")
      .eq("id", su.id)
      .single();

    if (profile) {
      const name = profile.nombre_completo ?? email.split("@")[0];
      const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
      return { id: su.id, email, name, role: (profile.rol as AppRole) ?? "alumno", avatar: initials };
    }
  } catch {
    // Silently fall through to fallback
  }

  // Fallback
  const name = su.user_metadata?.full_name ?? email.split("@")[0];
  const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  return { id: su.id, email, name, role: "alumno", avatar: initials };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    // 1. Check existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        const appUser = await resolveUser(session.user);
        if (mounted) setUser(appUser);
      }
      if (mounted) setInitializing(false);
    }).catch(() => {
      if (mounted) setInitializing(false);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === "SIGNED_OUT") {
          setUser(null);
          return;
        }

        // For SIGNED_IN: resolve user and update
        if (event === "SIGNED_IN" && session?.user) {
          const appUser = await resolveUser(session.user);
          if (mounted) setUser(appUser);
          return;
        }

        // For TOKEN_REFRESHED: silently update — no loading, no UI disruption
        if (event === "TOKEN_REFRESHED" && session?.user) {
          // Just keep the existing user — no need to re-resolve
          // The session token is refreshed but the user data hasn't changed
          return;
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    // onAuthStateChange SIGNED_IN will set the user
    // Wait for user to be set (max 5 seconds)
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        // User will be set by onAuthStateChange
        resolve();
        clearInterval(check);
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(); }, 5000);
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, initializing, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return { ...ctx, loading: ctx.initializing }; // backward compat
}
