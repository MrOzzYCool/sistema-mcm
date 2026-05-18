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
  "bg-blue-100 border-blue-300 text-blue-800",
  "bg-green-100 border-green-300 text-green-800",
  "bg-purple-100 border-purple-300 text-purple-800",
  "bg-orange-100 border-orange-300 text-orange-800",
  "bg-pink-100 border-pink-300 text-pink-800",
  "bg-teal-100 border-teal-300 text-teal-800",
  "bg-indigo-100 border-indigo-300 text-indigo-800",
  "bg-yellow-100 border-yellow-300 text-yellow-800",
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
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Error desconocido");
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }
    fetchHorario();
    return () => { mountedRef.current = false; };
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh] gap-3 text-mcm-muted">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Cargando horario...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-sm text-red-600 font-medium">{error}</p>
      </div>
    );
  }

  // Asignar colores por curso
  const cursoNombres = [...new Set(horario.map((h) => h.curso))];
  const colorMap = new Map(cursoNombres.map((c, i) => [c, COLORES_CURSO[i % COLORES_CURSO.length]]));

  // Agrupar por día
  const horarioPorDia = new Map<string, ClaseHorario[]>();
  for (const dia of DIAS_SEMANA) {
    horarioPorDia.set(dia, []);
  }
  for (const clase of horario) {
    const existing = horarioPorDia.get(clase.dia) ?? [];
    existing.push(clase);
    horarioPorDia.set(clase.dia, existing);
  }

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Mi Horario</h1>
          <p className="text-mcm-muted text-sm mt-0.5">Vista semanal de clases</p>
        </div>
        {carrera && ciclo && (
          <div className="flex items-center gap-2">
            <span className="badge-blue text-xs">{carrera}</span>
            <span className="badge-green text-xs">Ciclo {ciclo}</span>
          </div>
        )}
      </div>

      {/* Empty state */}
      {horario.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar size={40} className="mx-auto text-mcm-muted mb-3" />
          <h2 className="font-bold text-mcm-text text-lg mb-1">Sin horarios</h2>
          <p className="text-mcm-muted text-sm">
            {message ?? "No se encontraron horarios programados para tu ciclo actual."}
          </p>
        </div>
      ) : (
        <>
          {/* Leyenda de cursos */}
          <div className="flex flex-wrap gap-2">
            {cursoNombres.map((curso) => (
              <span key={curso} className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${colorMap.get(curso)}`}>
                {curso}
              </span>
            ))}
          </div>

          {/* Vista semanal */}
          <div className="card overflow-hidden p-0">
            <div className="px-6 py-4 border-b border-mcm-border flex items-center gap-2">
              <Calendar size={16} className="text-mcm-muted" />
              <h2 className="font-semibold text-mcm-text">Horario Semanal</h2>
            </div>

            {/* Grid semanal */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 divide-y md:divide-y-0 md:divide-x divide-mcm-border">
              {DIAS_SEMANA.map((dia) => {
                const clases = horarioPorDia.get(dia) ?? [];
                return (
                  <div key={dia} className="p-4 min-h-[200px]">
                    <h3 className="text-xs font-bold text-mcm-text uppercase tracking-wide mb-3 text-center">
                      {dia}
                    </h3>
                    {clases.length === 0 ? (
                      <p className="text-xs text-mcm-muted text-center mt-8">Sin clases</p>
                    ) : (
                      <div className="space-y-2">
                        {clases.map((clase) => (
                          <div
                            key={clase.id}
                            className={`rounded-lg border p-2.5 ${colorMap.get(clase.curso)}`}
                          >
                            <p className="text-xs font-bold leading-tight">{clase.curso}</p>
                            <p className="text-xs mt-1 opacity-80">
                              {clase.hora_inicio} - {clase.hora_fin}
                            </p>
                            {clase.aula && clase.aula !== "—" && (
                              <p className="text-xs mt-0.5 opacity-70">📍 {clase.aula}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabla resumen */}
          <div className="card overflow-hidden p-0">
            <div className="px-6 py-4 border-b border-mcm-border">
              <h2 className="font-semibold text-mcm-text">Detalle de clases</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Día", "Hora", "Curso", "Aula"].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {horario.map((clase) => (
                    <tr key={clase.id} className="border-t border-mcm-border hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-mcm-text">{clase.dia}</td>
                      <td className="py-3 px-4 text-mcm-muted font-mono text-xs">
                        {clase.hora_inicio} - {clase.hora_fin}
                      </td>
                      <td className="py-3 px-4 text-mcm-text">{clase.curso}</td>
                      <td className="py-3 px-4 text-mcm-muted">{clase.aula}</td>
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
