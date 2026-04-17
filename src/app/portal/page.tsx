"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Calendar, BookOpen, CreditCard, FileText, ArrowRight,
  TrendingUp, Clock, GraduationCap, Loader2,
} from "lucide-react";
import Link from "next/link";

interface PortalData {
  carrera: string;
  ciclo: number;
  totalCursos: number;
  totalCreditos: number;
  fechaInicio: string | null;
}

export default function PortalInicio() {
  const { user } = useAuth();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setLoading(false); return; }

      const res = await fetch("/api/portal/mis-cursos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const insc = json.inscripcion;
        const cursos = json.cursos ?? [];
        setData({
          carrera: insc?.carreras?.nombre_carrera ?? "Sin carrera asignada",
          ciclo: insc?.ciclo_actual ?? cursos[0]?.ciclo ?? 0,
          totalCursos: cursos.length,
          totalCreditos: cursos.reduce((a: number, c: { cursos?: { creditos?: number } }) => a + (c.cursos?.creditos ?? 0), 0),
          fechaInicio: insc?.fecha_inicio_ciclo ?? null,
        });
      }
    } catch (err) {
      console.error("Error cargando portal:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const isFuture = data?.fechaInicio ? new Date(data.fechaInicio) > new Date() : false;

  return (
    <div className="p-6 w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">
            Bienvenido, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-mcm-muted text-sm mt-0.5">{user?.email}</p>
        </div>
        {data && (
          <div className="flex items-center gap-2">
            <span className="badge-blue text-xs">{data.carrera}</span>
            <span className="badge-green text-xs">Ciclo {data.ciclo}</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-3 text-mcm-muted">
          <Loader2 size={20} className="animate-spin" /> <span className="text-sm">Cargando datos...</span>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="card flex items-center gap-4 bg-gradient-to-r from-[#8a2b1f] to-[#a93526] text-white border-0">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs">Ciclo actual</p>
              <p className="text-3xl font-bold">{data.ciclo || "—"}</p>
            </div>
          </div>
          <div className="card border-l-4 border-l-blue-500 py-5">
            <p className="text-xs text-mcm-muted font-medium uppercase tracking-wide">Cursos</p>
            <p className="text-2xl font-bold text-mcm-text mt-1">{data.totalCursos}</p>
            <p className="text-xs text-mcm-muted mt-1">Matriculados</p>
          </div>
          <div className="card border-l-4 border-l-green-500 py-5">
            <p className="text-xs text-mcm-muted font-medium uppercase tracking-wide">Créditos</p>
            <p className="text-2xl font-bold text-mcm-text mt-1">{data.totalCreditos}</p>
            <p className="text-xs text-mcm-muted mt-1">Total del ciclo</p>
          </div>
          <div className="card border-l-4 border-l-yellow-500 py-5">
            <p className="text-xs text-mcm-muted font-medium uppercase tracking-wide">Inicio de clases</p>
            {data.fechaInicio ? (
              <>
                <p className="text-sm font-bold text-mcm-text mt-1">
                  {new Date(data.fechaInicio).toLocaleDateString("es-PE", { day: "2-digit", month: "long" })}
                </p>
                {isFuture ? (
                  <span className="badge-yellow text-xs mt-1">Programado</span>
                ) : (
                  <span className="badge-blue text-xs mt-1">En curso</span>
                )}
              </>
            ) : (
              <p className="text-sm font-bold text-mcm-text mt-1">Por definir</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Accesos rápidos — más grandes */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ActionCard href="/portal/cursos" icon={<BookOpen size={24} />}
            label="Mis Cursos" desc="Ver materias, créditos y estado" color="bg-green-50 text-green-600" />
          <ActionCard href="/portal/calendario" icon={<Calendar size={24} />}
            label="Calendario" desc="Clases y evaluaciones" color="bg-blue-50 text-blue-600" />
          <ActionCard href="/portal/pagos" icon={<CreditCard size={24} />}
            label="Pagos" desc="Estado de cuenta y cuotas" color="bg-yellow-50 text-yellow-600" />
          <ActionCard href="/portal/tramites" icon={<FileText size={24} />}
            label="Trámites" desc="Solicitudes y certificados" color="bg-red-50 text-red-600" />
        </div>

        {/* Avisos */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-mcm-text">Avisos recientes</h2>
          <div className="space-y-3">
            <Aviso tipo="info" titulo="Inicio de clases" desc="El semestre 2026-I inicia el 14 de abril." />
            <Aviso tipo="warning" titulo="Matrícula" desc="Recuerda completar tu matrícula antes del 10 de abril." />
            <Aviso tipo="info" titulo="Horarios" desc="Los horarios del ciclo están disponibles en Calendario." />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ href, icon, label, desc, color }: {
  href: string; icon: React.ReactNode; label: string; desc: string; color: string;
}) {
  return (
    <Link href={href}
      className="card hover:shadow-md transition-all flex items-center gap-4 group py-5">
      <div className={`p-3 rounded-xl shrink-0 ${color} group-hover:scale-110 transition-transform`}>{icon}</div>
      <div className="flex-1">
        <p className="font-semibold text-mcm-text">{label}</p>
        <p className="text-xs text-mcm-muted mt-0.5">{desc}</p>
      </div>
      <ArrowRight size={16} className="text-mcm-muted group-hover:text-mcm-text transition-colors shrink-0" />
    </Link>
  );
}

function Aviso({ tipo, titulo, desc }: { tipo: "info" | "warning"; titulo: string; desc: string }) {
  const styles = {
    info:    "bg-blue-50 border-blue-200",
    warning: "bg-yellow-50 border-yellow-200",
  };
  return (
    <div className={`border rounded-xl p-3.5 ${styles[tipo]}`}>
      <p className="text-sm font-medium text-mcm-text">{titulo}</p>
      <p className="text-xs text-mcm-muted mt-0.5">{desc}</p>
    </div>
  );
}
