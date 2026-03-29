"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// ─── Roles por email (hasta conectar tabla de perfiles) ───────────────────────

const ROLE_MAP: Record<string, "super_admin" | "staff_tramites" | "gestor" | "alumno"> = {
  "admin@margaritacabrera.edu.pe":    "super_admin",
  "staff@margaritacabrera.edu.pe":    "staff_tramites",
  "nvasquez@margaritacabrera.edu.pe": "gestor",
};

function getRol(email: string) {
  return ROLE_MAP[email.toLowerCase()] ?? "alumno";
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "staff_tramites" | "gestor" | "alumno";
  avatar: string;
}

interface AuthCtx {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthCtx | null>(null);

function toAppUser(su: SupabaseUser): AppUser {
  const email  = su.email ?? "";
  const name   = su.user_metadata?.full_name ?? email.split("@")[0];
  const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  return { id: su.id, email, name, role: getRol(email), avatar: initials };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true); // true hasta que getSession responda

  useEffect(() => {
    // 1. Recuperar sesión existente al montar (persiste entre recargas)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? toAppUser(session.user) : null);
      setLoading(false);
    });

    // 2. Escuchar cambios de sesión (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ? toAppUser(session.user) : null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    // onAuthStateChange actualizará el user automáticamente
  }

  async function logout() {
    await supabase.auth.signOut();
    // onAuthStateChange pondrá user en null
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
