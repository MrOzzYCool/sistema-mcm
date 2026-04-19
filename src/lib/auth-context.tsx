"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// ─── Roles hardcodeados (admins) ─────────────────────────────────────────────

type AppRole = "super_admin" | "staff_tramites" | "gestor" | "actualizacion" | "profesor" | "alumno" | "cycle_manager";

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
    const { data: profile } = await supabase
      .from("profiles")
      .select("nombre_completo, rol, estado")
      .eq("id", su.id)
      .single();

    if (profile) {
      const name = profile.nombre_completo ?? email.split("@")[0];
      const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
      log(`👤 Profile found: ${name} (${profile.rol})`);
      return { id: su.id, email, name, role: (profile.rol as AppRole) ?? "alumno", avatar: initials };
    }
  } catch (err) {
    log(`⚠️ Profile query failed: ${err}`);
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

    // HARD TIMEOUT
    const hardTimeout = setTimeout(() => {
      if (!initDone) {
        log("⏰ HARD TIMEOUT 5s");
        finishInit();
      }
    }, 5000);

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

    // Wait for onAuthStateChange to set user (max 5s)
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 5000);
      const unsub = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          clearTimeout(timeout);
          unsub.data.subscription.unsubscribe();
          setTimeout(resolve, 50);
        }
      });
    });
    log("🔑 Login complete");
  }

  async function logout() {
    log("🚪 Logout");
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
