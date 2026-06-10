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
          <Loader2 size={20} className="text-white/70 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== "alumno") return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "linear-gradient(160deg, #a93526 0%, #6b1d14 50%, #3d1210 100%)" }}>

      {/* Logo */}
      <div className="mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-blanco.png" alt="I.E.S. Privada Margarita Cabrera"
          className="w-24 h-auto mx-auto drop-shadow-lg" />
      </div>

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold text-white">
          Bienvenido, {user.name?.split(" ")[0]}
        </h1>
        <p className="text-white/60 text-sm mt-1">¿A dónde deseas ir?</p>
      </div>

      {/* Selection cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl w-full">
        {/* SIIMC */}
        <Link href="/portal"
          className="group bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300 p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-white/30 transition-all">
            <BookOpen size={28} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">SIIMC</h2>
          <p className="text-xs text-white/50 font-medium mt-0.5">Sistema Integrado Institucional</p>
          <p className="text-sm text-white/70 mt-3">
            Pagos, calendario, cursos matriculados y trámites académicos
          </p>
          <span className="mt-5 text-xs font-semibold text-white bg-white/20 px-4 py-1.5 rounded-full group-hover:bg-white group-hover:text-[#a93526] transition-colors">
            Ingresar →
          </span>
        </Link>

        {/* Aula Virtual */}
        <Link href="/portal/aula-virtual"
          className="group bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300 p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-white/30 transition-all">
            <MonitorPlay size={28} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">Aula Virtual</h2>
          <p className="text-xs text-white/50 font-medium mt-0.5">Plataforma de Aprendizaje</p>
          <p className="text-sm text-white/70 mt-3">
            Clases, contenido semanal, tareas y evaluaciones de tus cursos
          </p>
          <span className="mt-5 text-xs font-semibold text-white bg-white/20 px-4 py-1.5 rounded-full group-hover:bg-white group-hover:text-[#a93526] transition-colors">
            Ingresar →
          </span>
        </Link>
      </div>

      {/* Footer */}
      <p className="text-xs text-white/40 mt-12">
        I.E.S. Privada Margarita Cabrera
      </p>
    </div>
  );
}
