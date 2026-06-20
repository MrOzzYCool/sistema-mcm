"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import SidebarAulaVirtual from "@/components/aula-virtual/SidebarAulaVirtual";

export default function AulaVirtualLayout({ children }: { children: React.ReactNode }) {
  const { user, initializing, forceReady } = useAuth();
  const router = useRouter();
  const [showEmergency, setShowEmergency] = useState(false);

  useEffect(() => {
    if (!initializing) { setShowEmergency(false); return; }
    const timer = setTimeout(() => setShowEmergency(true), 7000);
    return () => clearTimeout(timer);
  }, [initializing]);

  useEffect(() => {
    if (initializing) return;
    if (!user) router.replace("/");
    else if (user.forcePasswordReset) router.replace("/cambiar-contrasena");
    else if (user.role !== "alumno") router.replace("/dashboard");
  }, [user, initializing, router]);

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg,#C62828 0%,#8E0000 100%)" }}>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-blanco.png" alt="Logo" style={{ width: 80, height: "auto", margin: "0 auto 16px" }} />
          <p className="text-white/70 text-sm">Cargando aula virtual...</p>
          {showEmergency && (
            <button onClick={() => { forceReady(); router.replace("/"); }}
              className="mt-6 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg transition-colors">
              Reiniciar sesión
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!user || user.role !== "alumno") return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarAulaVirtual />
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Top header */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-600">Aula Virtual</p>
          <UserHeaderMenu user={user} />
        </header>
        {/* Content */}
        <main className="flex-1 overflow-auto">
          <div className="w-full px-6 lg:px-10 xl:px-16">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── User Header with notifications, avatar, dropdown ────────────────────────

function UserHeaderMenu({ user }: { user: { name: string; gender?: string; role?: string } }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  // Simple gender-based avatar
  const isFemale = user.gender?.toUpperCase() === "F" || user.gender?.toLowerCase() === "femenino";

  return (
    <div className="flex items-center gap-4">
      {/* Notifications bell */}
      <button className="relative text-gray-500 hover:text-gray-700 transition-colors" title="Notificaciones">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full text-[9px] font-bold text-amber-900 flex items-center justify-center">
          0
        </span>
      </button>

      <div className="w-px h-6 bg-gray-200" />

      {/* User info + dropdown */}
      <div className="relative">
        <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors">
          <div className="text-right hidden sm:block">
            <p className="text-sm text-gray-600 leading-tight">Hola, <span className="font-semibold text-gray-800">{user.name?.split(" ")[0]}</span></p>
            <p className="text-xs text-gray-400">Estudiante</p>
          </div>
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ background: isFemale ? "#FCE4EC" : "#E3F2FD" }}>
            {isFemale ? (
              <svg width="30" height="30" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="15" r="7" fill="#FFCC80"/>
                <path d="M11 15c0 0-1-8 7-8s7 8 7 8" fill="#5D4037"/>
                <path d="M10 15c0 0 0-3 1-4" stroke="#5D4037" strokeWidth="2" fill="none"/>
                <path d="M26 15c0 0 0-3-1-4" stroke="#5D4037" strokeWidth="2" fill="none"/>
                <path d="M11 16c-1 3-2 7-2 10" stroke="#5D4037" strokeWidth="2.5" fill="none"/>
                <path d="M25 16c1 3 2 7 2 10" stroke="#5D4037" strokeWidth="2.5" fill="none"/>
                <circle cx="15.5" cy="15" r="1" fill="#3E2723"/>
                <circle cx="20.5" cy="15" r="1" fill="#3E2723"/>
                <path d="M16.5 18.5c0 0 .8 1 1.5 1s1.5-1 1.5-1" stroke="#E57373" strokeWidth="0.8" fill="none"/>
                <path d="M9 28c0-5 4-9 9-9s9 4 9 9" fill="#EC407A"/>
              </svg>
            ) : (
              <svg width="30" height="30" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="15" r="7" fill="#FFCC80"/>
                <path d="M12 13c0-4 3-6 6-6s6 2 6 6" fill="#4E342E"/>
                <rect x="12" y="10" width="12" height="3" rx="1" fill="#4E342E"/>
                <circle cx="15.5" cy="15" r="1" fill="#3E2723"/>
                <circle cx="20.5" cy="15" r="1" fill="#3E2723"/>
                <path d="M16.5 18.5c0 0 .8 1 1.5 1s1.5-1 1.5-1" stroke="#3E2723" strokeWidth="0.8" fill="none"/>
                <path d="M9 28c0-5 4-9 9-9s9 4 9 9" fill="#1976D2"/>
              </svg>
            )}
          </div>
          {/* Chevron */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <>
            <button onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40" aria-label="Cerrar menú" />
            <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 min-w-[180px]">
              <button onClick={() => { router.push("/seleccionar"); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
                Cambiar módulo
              </button>
              <button onClick={() => { handleLogout(); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                Cerrar sesión
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
