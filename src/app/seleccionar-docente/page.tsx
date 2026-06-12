"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { MonitorPlay, Loader2 } from "lucide-react";
import Link from "next/link";

export default function SeleccionarDocente() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/");
    else if (user.forcePasswordReset) router.replace("/cambiar-contrasena");
    else if (user.role !== "profesor") router.replace("/dashboard");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg,#C62828 0%,#8E0000 100%)" }}>
        <Loader2 size={20} className="text-white/70 animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "profesor") return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "linear-gradient(160deg, #C62828 0%, #8E0000 50%, #4E0000 100%)" }}>

      {/* Logo */}
      <div className="mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mc-icon.png" alt="MC" className="w-20 h-20 mx-auto drop-shadow-lg" />
      </div>

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold text-white">
          Bienvenido, {user.name?.split(" ")[0]}
        </h1>
        <p className="text-white/60 text-sm mt-1">Docente</p>
      </div>

      {/* Single option: Aula Virtual */}
      <div className="max-w-sm w-full">
        <Link href="/aula-virtual-docente"
          className="group bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300 p-8 flex flex-col items-center text-center block">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-white/30 transition-all">
            <MonitorPlay size={28} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">Aula Virtual</h2>
          <p className="text-xs text-white/50 font-medium mt-0.5">Panel Docente</p>
          <p className="text-sm text-white/70 mt-3">
            Gestiona contenidos, tareas y calificaciones de tus cursos
          </p>
          <span className="mt-5 text-xs font-semibold text-white bg-white/20 px-4 py-1.5 rounded-full group-hover:bg-white group-hover:text-[#C62828] transition-colors">
            Ingresar →
          </span>
        </Link>
      </div>

      <p className="text-xs text-white/40 mt-12">I.E.S. Privada Margarita Cabrera</p>
    </div>
  );
}
