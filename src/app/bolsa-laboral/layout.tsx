"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import PortalAlumnaHeader from "@/components/bolsa-laboral/PortalAlumnaHeader";

/** Routes within /bolsa-laboral that are publicly accessible (no auth required) */
const PUBLIC_PATHS = ["/bolsa-laboral/publicar-oferta", "/bolsa-laboral/solicitar-acceso"];

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

/** Maps a role to its default route */
function getRoleRoute(role: string): string {
  switch (role) {
    case "alumno":
      return "/seleccionar";
    case "profesor":
      return "/seleccionar-docente";
    case "alumna_bolsa":
      return "/bolsa-laboral";
    default:
      return "/dashboard";
  }
}

export default function BolsaLaboralLayout({ children }: { children: React.ReactNode }) {
  const { user, initializing, forceReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showEmergency, setShowEmergency] = useState(false);

  const isPublic = isPublicPage(pathname);

  // Emergency button after 7s of initializing
  useEffect(() => {
    if (!initializing) {
      setShowEmergency(false);
      return;
    }
    const timer = setTimeout(() => setShowEmergency(true), 7000);
    return () => clearTimeout(timer);
  }, [initializing]);

  // Auth guard - only for non-public pages
  useEffect(() => {
    if (initializing || isPublic) return;

    if (!user) {
      router.replace("/");
    } else if (user.forcePasswordReset) {
      router.replace("/cambiar-contrasena");
    } else if (user.role !== "alumna_bolsa") {
      router.replace(getRoleRoute(user.role));
    }
  }, [user, initializing, router, isPublic]);

  // Public pages: render directly without auth guard or portal chrome
  if (isPublic) {
    return <>{children}</>;
  }

  // Loading state for authenticated pages
  if (initializing) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg, #C62828 0%, #8E0000 100%)" }}
      >
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-blanco.png"
            alt="Logo"
            style={{ width: 80, height: "auto", margin: "0 auto 16px" }}
          />
          <p className="text-white/70 text-sm">Cargando portal...</p>
          {showEmergency && (
            <button
              onClick={() => {
                forceReady();
                router.replace("/");
              }}
              className="mt-6 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg transition-colors"
            >
              Reiniciar sesión
            </button>
          )}
        </div>
      </div>
    );
  }

  // If not authenticated or wrong role, render nothing (redirect is happening)
  if (!user || user.role !== "alumna_bolsa") return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PortalAlumnaHeader />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
