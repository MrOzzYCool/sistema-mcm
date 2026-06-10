"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import SidebarAulaVirtual from "@/components/aula-virtual/SidebarAulaVirtual";
import { LogOut } from "lucide-react";

export default function AulaVirtualLayout({ children }: { children: React.ReactNode }) {
  const { user, initializing, forceReady, logout } = useAuth();
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
        style={{ background: "linear-gradient(160deg,#1e293b 0%,#0f172a 100%)" }}>
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

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SidebarAulaVirtual />
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Top header */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-end gap-4">
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-800 leading-tight">{user.name}</p>
              <p className="text-xs text-gray-500">Aula Virtual</p>
            </div>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: "linear-gradient(135deg, #1e293b, #334155)" }}>
              {user.avatar}
            </div>
            <button onClick={handleLogout} title="Cerrar sesión"
              className="text-gray-400 hover:text-red-600 transition-colors ml-1">
              <LogOut size={16} />
            </button>
          </div>
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
