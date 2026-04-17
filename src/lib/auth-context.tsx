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
  initializing: boolean;
  forceReady: () => void;  // Emergency: force initializing=false
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
      return { id: su.id, email, name, role: (profile.rol as AppRole) ?? "alumno", avatar: initials };
    }
  } catch {
    // fall through
  }

  const name = su.user_metadata?.full_name ?? email.split("@")[0];
  const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  return { id: su.id, email, name, role: "alumno", avatar: initials };
}

// ─── Timeout helper ──────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => {
      log(`⚠️ Timeout after ${ms}ms — using fallback`);
      resolve(fallback);
    }, ms)),
  ]);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Emergency escape hatch
  function forceReady() {
    log("🚨 forceReady called — clearing auth state");
    setUser(null);
    setInitializing(false);
    // Clear Supabase localStorage to allow fresh login
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith("sb-"));
      keys.forEach(k => localStorage.removeItem(k));
      log(`Cleared ${keys.length} Supabase localStorage keys`);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    let mounted = true;
    let initDone = false;

    function finishInit() {
      if (!initDone && mounted) {
        initDone = true;
        setInitializing(false);
        log("✅ Initialization complete");
      }
    }

    log("🔄 Starting auth initialization...");

    // HARD TIMEOUT: No matter what, initializing MUST end after 5 seconds
    const hardTimeout = setTimeout(() => {
      if (!initDone) {
        log("⏰ HARD TIMEOUT 5s — forcing initializing=false");
        finishInit();
      }
    }, 5000);

    // 1. Check existing session with timeout
    const sessionPromise = supabase.auth.getSession();
    log("📡 Calling getSession()...");

    withTimeout(sessionPromise, 4000, { data: { session: null }, error: null })
      .then(async ({ data: { session } }) => {
        if (!mounted) return;
        log(`📡 getSession responded — session: ${session ? "YES" : "NO"}`);

        if (session?.user) {
          log(`👤 Resolving user: ${session.user.email}`);
          const appUser = await withTimeout(
            resolveUser(session.user),
            3000,
            { id: session.user.id, email: session.user.email ?? "", name: session.user.email?.split("@")[0] ?? "User", role: "alumno" as AppRole, avatar: "??" }
          );
          if (mounted) {
            setUser(appUser);
            log(`👤 User resolved: ${appUser.name} (${appUser.role})`);
          }
        }

        finishInit();
      })
      .catch((err) => {
        log(`❌ getSession error: ${err}`);
        finishInit();
      });

    // 2. Listen for auth changes (post-initialization)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        log(`🔔 onAuthStateChange: ${event}`);

        if (event === "SIGNED_OUT") {
          setUser(null);
          return;
        }

        if (event === "SIGNED_IN" && session?.user) {
          log(`🔔 SIGNED_IN — resolving ${session.user.email}`);
          const appUser = await withTimeout(
            resolveUser(session.user),
            3000,
            { id: session.user.id, email: session.user.email ?? "", name: session.user.email?.split("@")[0] ?? "User", role: "alumno" as AppRole, avatar: "??" }
          );
          if (mounted) {
            setUser(appUser);
            log(`🔔 User set: ${appUser.name}`);
          }
          // If init hasn't finished yet (login during init), finish it
          finishInit();
          return;
        }

        // TOKEN_REFRESHED: do nothing — user data hasn't changed
        if (event === "TOKEN_REFRESHED") {
          log("🔔 TOKEN_REFRESHED — no action needed");
          return;
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(hardTimeout);
      subscription.unsubscribe();
      log("🧹 Auth cleanup");
    };
  }, []);

  async function login(email: string, password: string) {
    log(`🔑 Login attempt: ${email}`);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      log(`🔑 Login failed: ${error.message}`);
      throw new Error(error.message);
    }
    log("🔑 signInWithPassword OK — waiting for onAuthStateChange...");
    // Wait for onAuthStateChange to set the user (max 5s)
    await new Promise<void>((resolve) => {
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 100;
        if (elapsed >= 5000) { clearInterval(interval); resolve(); }
      }, 100);
      // Also resolve early via a one-time subscription check
      const unsub = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          clearInterval(interval);
          unsub.data.subscription.unsubscribe();
          // Small delay to let the main listener process first
          setTimeout(resolve, 50);
        }
      });
    });
    log("🔑 Login flow complete");
  }

  async function logout() {
    log("🚪 Logout");
    await supabase.auth.signOut();
    setUser(null);
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
