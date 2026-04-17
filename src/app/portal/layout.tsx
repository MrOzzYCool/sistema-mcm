"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import SidebarAlumno from "@/components/SidebarAlumno";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, initializing, forceReady } = useAuth();
  const router = useRouter();
  const [showEmergency, setShowEmergency] = useState(false);

  // Show emergency button after 7 seconds of initializing
  useEffect(() => {
    if (!initializing) { setShowEmergency(false); return; }
    const timer = setTimeout(() => setShowEmergency(true), 7000);
    return () => clearTimeout(timer);
  }, [initializing]);

  useEffect(() => {
    if (initializing) return;
    if (!user) router.replace("/");
    else if (user.role !== "alumno") router.replace("/dashboard");
  }, [user, initializing, router]);

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg,#a93526 0%,#8a2b1f 100%)" }}>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-blanco.png" alt="Logo" style={{ width: 80, height: "auto", margin: "0 auto 16px" }} />
          <p className="text-white/70 text-sm">Cargando portal...</p>
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
    <div className="flex min-h-screen bg-mcm-gray">
      <SidebarAlumno />
      <main className="flex-1 overflow-auto max-w-screen-2xl">
        {children}
      </main>
    </div>
  );
}
