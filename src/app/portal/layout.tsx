"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import SidebarAlumno from "@/components/SidebarAlumno";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return; // Wait for initial session check
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
        </div>
      </div>
    );
  }

  if (!user || user.role !== "alumno") return null;

  return (
    <div className="flex min-h-screen bg-mcm-gray">
      <SidebarAlumno />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
