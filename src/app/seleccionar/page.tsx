"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { BookOpen, MonitorPlay, Loader2 } from "lucide-react";
import Link from "next/link";

export default function SeleccionarModulo() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/");
    else if (user.forcePasswordReset) router.replace("/cambiar-contrasena");
    else if (user.role !== "alumno") router.replace("/dashboard");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg,#a93526 0%,#8a2b1f 100%)" }}>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-blanco.png" alt="Logo" style={{ width: 80, height: "auto", margin: "0 auto 16px" }} />
          <p className="text-white/70 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "alumno") return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "linear-gradient(160deg, #f8f9fa 0%, #e9ecef 100%)" }}>
      {/* Logo + Header */}
      <div className="text-center mb-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-blanco.png" alt="MCM" className="w-20 h-auto mx-auto mb-4 drop-shadow-lg"
          style={{ filter: "drop-shadow(0 2px 8px rgba(169,53,38,0.3))" }} />
        <h1 className="text-2xl font-bold text-mcm-text">
          Bienvenido, {user.name?.split(" ")[0]}
        </h1>
        <p className="text-mcm-muted text-sm mt-1">¿A dónde deseas ir?</p>
      </div>

      {/* Selection cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl w-full">
        {/* Sistema Interno */}
        <Link href="/portal"
          className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 p-8 flex flex-col items-center text-center border-2 border-transparent hover:border-[#a93526]/30">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#a93526] to-[#8a2b1f] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <BookOpen size={28} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-mcm-text">Sistema Interno</h2>
          <p className="text-sm text-mcm-muted mt-2">
            Pagos, calendario, cursos matriculados y trámites académicos
          </p>
          <span className="mt-4 text-xs font-semibold text-[#a93526] bg-red-50 px-3 py-1 rounded-full group-hover:bg-[#a93526] group-hover:text-white transition-colors">
            Ingresar →
          </span>
        </Link>

        {/* Aula Virtual */}
        <Link href="/portal/aula-virtual"
          className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 p-8 flex flex-col items-center text-center border-2 border-transparent hover:border-[#a93526]/30">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1e293b] to-[#334155] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <MonitorPlay size={28} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-mcm-text">Aula Virtual</h2>
          <p className="text-sm text-mcm-muted mt-2">
            Clases, contenido semanal, tareas y evaluaciones de tus cursos
          </p>
          <span className="mt-4 text-xs font-semibold text-[#1e293b] bg-slate-100 px-3 py-1 rounded-full group-hover:bg-[#1e293b] group-hover:text-white transition-colors">
            Ingresar →
          </span>
        </Link>
      </div>

      {/* Footer */}
      <p className="text-xs text-mcm-muted mt-10">
        I.E.S. Privada Margarita Cabrera
      </p>
    </div>
  );
}
