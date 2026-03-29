"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Solo redirigir cuando ya sabemos que no hay sesión (loading = false)
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  // Mientras Supabase verifica la sesión, mostrar pantalla de carga
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg,#a93526 0%,#8a2b1f 100%)" }}>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-blanco.png" alt="Logo" style={{ width: 80, height: "auto", margin: "0 auto 16px" }} />
          <p className="text-white/70 text-sm">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-mcm-gray">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
