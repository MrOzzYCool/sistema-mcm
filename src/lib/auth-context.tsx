"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// ─── Roles hardcodeados (admins) ─────────────────────────────────────────────

type AppRole = "super_admin" | "staff_tramites" | "gestor" | "actualizacion" | "profesor" | "alumno" | "cycle_manager" | "administradora" | "secretaria_academica" | "secretaria_atencion_academica" | "coordinacion_academica" | "gerenta";

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
  forcePasswordReset?: boolean;
}

interface AuthCtx {
  user: AppUser | null;
  initializing: boolean;
  forceReady: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

function log(msg: string) {
  console.info(`[AUTH ${new Date().toISOString().slice(11, 23)}] ${msg}`);
}

// ─── Resolver rol ────────────────────────────────────────────────────────────

async function resolveUser(su: SupabaseUser): Promise<AppUser> {
  const email = su.email ?? "";
  const emailLow = email.toLowerCase();

  const adminRole = ADMIN_ROLES[emailLow];
  if (adminRole) {
    const name = su.user_metadata?.full_name ?? email.split("@")[0];
    const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    return { id: su.id, email, name, role: adminRole, avatar: initials };
  }

  try {
    // Try API endpoint first (bypasses RLS reliably)
    // Get token from localStorage directly to avoid calling getSession() which can deadlock
    let token: string | undefined;
    try {
      const storageKeys = Object.keys(localStorage).filter(k => k.startsWith("sb-"));
      for (const key of storageKeys) {
        try {
          const data = JSON.parse(localStorage.getItem(key) ?? "");
          if (data?.access_token) { token = data.access_token; break; }
        } catch { /* skip */ }
      }
    } catch { /* localStorage not available */ }

    if (token) {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 3000);
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(tid);
        if (res.ok) {
          const apiProfile = await res.json();
          if (apiProfile.rol) {
            const name = apiProfile.nombre_completo ?? email.split("@")[0];
            const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
            log(`👤 Profile via API: ${name} (${apiProfile.rol})`);
            return { id: su.id, email, name, role: (apiProfile.rol as AppRole), avatar: initials, forcePasswordReset: !!apiProfile.force_password_reset };
          }
        }
      } catch {
        log(`⚠️ API /auth/me failed`);
      }
    }

    // Fallback: direct query
    const profilePromise = supabase
      .from("profiles")
      .select("nombre_completo, rol, estado, force_password_reset")
      .eq("id", su.id)
      .single();

    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: "timeout" } }), 3000)
    );

    const { data: profile } = await Promise.race([profilePromise, timeoutPromise]);

    if (profile && profile.rol) {
      const name = profile.nombre_completo ?? email.split("@")[0];
      const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
      log(`👤 Profile direct: ${name} (${profile.rol})`);
      return { id: su.id, email, name, role: (profile.rol as AppRole), avatar: initials, forcePasswordReset: !!profile.force_password_reset };
    }
  } catch (err) {
    log(`⚠️ Profile resolution failed: ${err}`);
  }

  // Fallback — use metadata
  const name = su.user_metadata?.full_name ?? email.split("@")[0];
  const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  log(`👤 Using fallback profile: ${name}`);
  return { id: su.id, email, name, role: "alumno", avatar: initials };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const userRef = useRef<AppUser | null>(null); // Always holds the latest valid user

  // Safe setter: never replace a good user with a worse one
  function safeSetUser(newUser: AppUser | null) {
    if (!newUser) {
      // Only clear if explicitly signing out
      userRef.current = null;
      setUser(null);
      log("👤 User cleared");
      return;
    }

    const current = userRef.current;
    // If we already have a valid user with a real name, don't replace with a fallback
    if (current && current.id === newUser.id && current.name && current.name !== current.email.split("@")[0]) {
      // Current user has a real name from profiles
      if (!newUser.name || newUser.name === newUser.email.split("@")[0]) {
        // New user only has email-derived name — keep the better one
        log(`👤 Keeping existing profile (${current.name}) over fallback (${newUser.name})`);
        return;
      }
    }

    userRef.current = newUser;
    setUser(newUser);
    log(`👤 User set: ${newUser.name} (${newUser.role}) avatar=${newUser.avatar}`);
  }

  function forceReady() {
    log("🚨 forceReady called");
    userRef.current = null;
    setUser(null);
    setInitializing(false);
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith("sb-"));
      keys.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    let mounted = true;
    let initDone = false;

    function finishInit() {
      if (!initDone && mounted) {
        initDone = true;
        setInitializing(false);
        log("✅ Init complete");
      }
    }

    log("🔄 Starting auth init...");

    // HARD TIMEOUT — increased to 8s for slow connections
    const hardTimeout = setTimeout(() => {
      if (!initDone) {
        log("⏰ HARD TIMEOUT 8s");
        finishInit();
      }
    }, 8000);

    // 1. Check existing session
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!mounted) return;
        log(`📡 getSession: ${session ? "has session" : "no session"}`);

        if (session?.user) {
          try {
            const appUser = await resolveUser(session.user);
            if (mounted) safeSetUser(appUser);
          } catch (err) {
            log(`❌ resolveUser failed: ${err}`);
          }
        }
        finishInit();
      })
      .catch((err) => {
        log(`❌ getSession error: ${err}`);
        if (mounted) finishInit();
      });

    // 2. Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        log(`🔔 ${event}`);

        if (event === "SIGNED_OUT") {
          safeSetUser(null);
          return;
        }

        if (event === "SIGNED_IN" && session?.user) {
          try {
            const appUser = await resolveUser(session.user);
            if (mounted) safeSetUser(appUser);
          } catch (err) {
            log(`❌ SIGNED_IN resolveUser failed: ${err}`);
          }
          finishInit();
          return;
        }

        // TOKEN_REFRESHED — do nothing, user data hasn't changed
      }
    );

    return () => {
      mounted = false;
      clearTimeout(hardTimeout);
      subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string) {
    log(`🔑 Login: ${email}`);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    log("🔑 signIn OK — waiting for user resolution...");

    // Wait briefly for onAuthStateChange to resolve the user (max 3s)
    // The login page's useEffect will handle redirect when user is set
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (userRef.current) break;
    }
    log(`🔑 Login complete — user: ${userRef.current?.name ?? "pending"}`);
  }

  async function logout() {
    log("🚪 Logout");
    const { clearTokenCache } = await import("@/lib/get-token");
    clearTokenCache();
    await supabase.auth.signOut();
    safeSetUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, initializing, forceReady, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return { ...ctx, loading: ctx.initializing };
}
