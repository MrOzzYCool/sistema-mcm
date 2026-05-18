"use client";

import { useState, useEffect, useRef } from "react";
import { getAccessToken } from "@/lib/get-token";
import { Calendar, Loader2, AlertCircle } from "lucide-react";

interface ClaseHorario {
  id: string;
  dia: string;
  dia_numero: number;
  curso: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string;
}

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const COLORES_CURSO = [
  "bg-blue-50 border-blue-200 text-blue-800",
  "bg-green-50 border-green-200 text-green-800",
  "bg-purple-50 border-purple-200 text-purple-800",
  "bg-orange-50 border-orange-200 text-orange-800",
  "bg-pink-50 border-pink-200 text-pink-800",
  "bg-teal-50 border-teal-200 text-teal-800",
  "bg-indigo-50 border-indigo-200 text-indigo-800",
  "bg-yellow-50 border-yellow-200 text-yellow-800",
];

export default function CalendarioPage() {
  const [horario, setHorario] = useState<ClaseHorario[]>([]);
  const [carrera, setCarrera] = useState<string | null>(null);
  const [ciclo, setCiclo] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    async function fetchHorario() {
      try {
        const token = await getAccessToken();
        if (!mountedRef.current || !token) return;
        const res = await fetch("/api/portal/mi-horario", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!mountedRef.current) return;
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Error al cargar horario");
        }
        const data = await res.json();
        if (!mountedRef.current) return;
        setHorario(data.horario ?? []);
        setCarrera(data.carrera ?? null);
        setCiclo(data.ciclo ?? null);
        setMessage(data.message ?? null);
      } catch (err) {
        if (mountedRef.current) setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }
    fetchHorario();
    return () => { mountedRef.current = false; };
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh] gap-3 text-mcm-muted">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Cargando horario...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-red-600 font-medium">{error}</p>
      </div>
    );
  }

  // Asignar colores por curso
  const cursoNombres = [...new Set(horario.map((h) => h.curso))];
  const colorMap = new Map(cursoNombres.map((c, i) => [c, COLORES_CURSO[i % COLORES_CURSO.length]]));

  // Agrupar por día
  const horarioPorDia = new Map<string, ClaseHorario[]>();
  for (const dia of DIAS_SEMANA) horarioPorDia.set(dia, []);
  for (const clase of horario) {
    const existing = horarioPorDia.get(clase.dia) ?? [];
    existing.push(clase);
    horarioPorDia.set(clase.dia, existing);
  }

  // Filtrar días sin clases para la vista compacta
  const diasConClases = DIAS_SEMANA.filter((d) => (horarioPorDia.get(d) ?? []).length > 0);
  const diasMostrar = diasConClases.length > 0 ? diasConClases : DIAS_SEMANA;

  // Check if any class has aula
  const hasAula = horario.some((h) => h.aula && h.aula !== "—");

  return (
    <div className="p-4 sm:p-6 w-full space-y-4">
      {/* Header compacto */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-mcm-text">Mi Horario</h1>
        {carrera && ciclo && (
          <div className="flex items-center gap-1.5">
            <span className="badge-blue text-xs">{carrera}</span>
            <span className="badge-green text-xs">Ciclo {ciclo}</span>
          </div>
        )}
      </div>

      {/* Empty state */}
      {horario.length === 0 ? (
        <div className="card text-center py-10">
          <Calendar size={32} className="mx-auto text-mcm-muted mb-2" />
          <p className="text-mcm-muted text-sm">
            {message ?? "No se encontraron horarios programados para tu ciclo actual."}
          </p>
        </div>
      ) : (
        <>
          {/* Layout 2 columnas: Horario (70%) + Sidebar (30%) */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Horario semanal */}
            <div className="flex-1 card p-0 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-mcm-border flex items-center gap-2">
                <Calendar size={14} className="text-mcm-muted" />
                <h2 className="font-semibold text-mcm-text text-sm">Horario Semanal</h2>
              </div>
              <div className={`grid grid-cols-${Math.min(diasMostrar.length, 6)} divide-x divide-mcm-border`}
                style={{ gridTemplateColumns: `repeat(${Math.min(diasMostrar.length, 6)}, minmax(0, 1fr))` }}>
                {diasMostrar.map((dia) => {
                  const clases = horarioPorDia.get(dia) ?? [];
                  return (
                    <div key={dia} className="p-2 min-h-[120px]">
                      <h3 className="text-[10px] font-bold text-mcm-muted uppercase tracking-wider text-center mb-2">
                        {dia.slice(0, 3)}
                      </h3>
                      <div className="space-y-1.5">
                        {clases.map((clase) => (
                          <div key={clase.id} className={`rounded-md border p-1.5 ${colorMap.get(clase.curso)}`}>
                            <p className="text-[10px] font-bold leading-tight truncate">{clase.curso}</p>
                            <p className="text-[9px] mt-0.5 opacity-75">{clase.hora_inicio}-{clase.hora_fin}</p>
                            {clase.aula && clase.aula !== "—" && (
                              <p className="text-[9px] opacity-60">{clase.aula}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar: Leyenda + Info */}
            <div className="lg:w-56 shrink-0 space-y-3">
              {/* Leyenda */}
              <div className="card p-3">
                <h3 className="text-xs font-semibold text-mcm-text mb-2">Cursos</h3>
                <div className="space-y-1.5">
                  {cursoNombres.map((curso) => (
                    <div key={curso} className={`flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-medium ${colorMap.get(curso)}`}>
                      <span className="truncate">{curso}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Resumen */}
              <div className="card p-3">
                <h3 className="text-xs font-semibold text-mcm-text mb-2">Resumen</h3>
                <div className="space-y-1 text-xs text-mcm-muted">
                  <p><span className="font-medium text-mcm-text">{cursoNombres.length}</span> cursos</p>
                  <p><span className="font-medium text-mcm-text">{horario.length}</span> bloques/semana</p>
                  <p><span className="font-medium text-mcm-text">{diasConClases.length}</span> días con clases</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla detalle compacta */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-mcm-border">
              <h2 className="font-semibold text-mcm-text text-sm">Detalle</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-2 px-3 text-mcm-muted font-medium uppercase tracking-wide">Día</th>
                    <th className="text-left py-2 px-3 text-mcm-muted font-medium uppercase tracking-wide">Hora</th>
                    <th className="text-left py-2 px-3 text-mcm-muted font-medium uppercase tracking-wide">Curso</th>
                    {hasAula && <th className="text-left py-2 px-3 text-mcm-muted font-medium uppercase tracking-wide">Aula</th>}
                  </tr>
                </thead>
                <tbody>
                  {horario.map((clase) => (
                    <tr key={clase.id} className="border-t border-mcm-border hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-mcm-text">{clase.dia}</td>
                      <td className="py-2 px-3 text-mcm-muted font-mono">{clase.hora_inicio}-{clase.hora_fin}</td>
                      <td className="py-2 px-3 text-mcm-text">{clase.curso}</td>
                      {hasAula && <td className="py-2 px-3 text-mcm-muted">{clase.aula}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
