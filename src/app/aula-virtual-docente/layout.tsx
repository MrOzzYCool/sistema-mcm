"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import SidebarDocenteAV from "@/components/aula-virtual/SidebarDocenteAV";

export default function AulaVirtualDocenteLayout({ children }: { children: React.ReactNode }) {
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
    // Allow profesor role - other roles will be handled by the API
  }, [user, initializing, router]);

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg,#C62828 0%,#8E0000 100%)" }}>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-blanco.png" alt="Logo" style={{ width: 80, height: "auto", margin: "0 auto 16px" }} />
          <p className="text-white/70 text-sm">Cargando...</p>
          {showEmergency && (
            <button onClick={() => { forceReady(); router.replace("/"); }}
              className="mt-6 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg">
              Reiniciar sesión
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarDocenteAV />
      <div className="flex-1 flex flex-col overflow-auto">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-600">Aula Virtual — Docente</p>
          <UserHeaderMenuDocente user={user} />
        </header>
        <main className="flex-1 overflow-auto">
          <div className="w-full px-6 lg:px-10 xl:px-16">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function UserHeaderMenuDocente({ user }: { user: { name: string; gender?: string } }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  const isFemale = user.gender?.toUpperCase() === "F" || user.gender?.toLowerCase() === "femenino";

  return (
    <div className="flex items-center gap-4">
      {/* Notifications bell */}
      <button className="relative text-gray-500 hover:text-gray-700 transition-colors" title="Notificaciones">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full text-[9px] font-bold text-amber-900 flex items-center justify-center">0</span>
      </button>

      <div className="w-px h-6 bg-gray-200" />

      {/* User info + dropdown */}
      <div className="relative">
        <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors">
          <div className="text-right hidden sm:block">
            <p className="text-sm text-gray-600 leading-tight">Hola, <span className="font-semibold text-gray-800">{user.name?.split(" ")[0]}</span></p>
            <p className="text-xs text-gray-400">Docente</p>
          </div>
          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={isFemale ? "/avatars/female.svg" : "/avatars/male.svg"} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        {menuOpen && (
          <>
            <button onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40" aria-label="Cerrar menú" />
            <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 min-w-[180px]">
              <button onClick={() => { router.push("/seleccionar-docente"); setMenuOpen(false); }}
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
