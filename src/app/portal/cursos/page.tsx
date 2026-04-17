"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { BookOpen, Clock, TrendingUp, Loader2, RefreshCw, AlertCircle } from "lucide-react";

interface Inscripcion {
  ciclo_actual: number;
  fecha_inicio_ciclo: string;
  estado: string;
  carreras: { nombre_carrera: string; duracion_ciclos: number };
}

interface AlumnoCurso {
  id: string;
  ciclo: number;
  estado: string;
  cursos: { nombre_curso: string; creditos: number };
}

interface HistorialCiclo {
  ciclo: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: string;
}

export default function CursosAlumnoPage() {
  const [inscripcion, setInscripcion] = useState<Inscripcion | null>(null);
  const [cursos, setCursos]           = useState<AlumnoCurso[]>([]);
  const [historial, setHistorial]     = useState<HistorialCiclo[]>([]);
  const [firstLoad, setFirstLoad]     = useState(true);  // only true until first successful fetch
  const [error, setError]             = useState("");
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  async function fetchCursos() {
    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mountedRef.current) return;

      const token = session?.access_token;
      if (!token) {
        if (firstLoad) setError("Sesión no disponible. Recarga la página.");
        return;
      }

      const res = await fetch("/api/portal/mis-cursos", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${res.status}`);
      }

      const data = await res.json();
      if (!mountedRef.current) return;

      setInscripcion(data.inscripcion);
      setCursos(data.cursos ?? []);
      setHistorial(data.historial ?? []);
      setFirstLoad(false);
      setError("");
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : "Error cargando cursos";
      // Only show error if we haven't loaded data yet
      if (firstLoad) setError(msg);
      else console.warn("Background refresh failed:", msg);
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current && firstLoad) setFirstLoad(false);
    }
  }

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    fetchCursos();
    return () => { mountedRef.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Silent refresh on tab focus — no spinner, no loading state
  useEffect(() => {
    function onFocus() {
      if (document.visibilityState === "visible" && !firstLoad) {
        fetchCursos(); // Background refresh — existing data stays visible
      }
    }
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }); // No deps — always uses latest refs

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  if (firstLoad && !error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh] gap-3 text-mcm-muted">
        <Loader2 size={20} className="animate-spin" /> <span className="text-sm">Cargando cursos...</span>
      </div>
    );
  }

  if (error && cursos.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card text-center py-12">
          <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
          <h2 className="font-bold text-mcm-text text-lg mb-1">Error al cargar cursos</h2>
          <p className="text-mcm-muted text-sm mb-4">{error}</p>
          <button onClick={() => { setFirstLoad(true); setError(""); fetchCursos(); }} className="btn-primary text-sm">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!inscripcion && cursos.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card text-center py-12">
          <BookOpen size={40} className="mx-auto text-mcm-muted mb-3" />
          <h2 className="font-bold text-mcm-text text-lg mb-1">Sin inscripción activa</h2>
          <p className="text-mcm-muted text-sm">Contacta a secretaría para completar tu matrícula.</p>
        </div>
      </div>
    );
  }

  const totalCreditos = cursos.reduce((a, c) => a + (c.cursos?.creditos ?? 0), 0);
  const cicloActual = inscripcion?.ciclo_actual ?? cursos[0]?.ciclo ?? "—";

  return (
    <div className="p-6 w-full max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Mis Cursos</h1>
          <p className="text-mcm-muted text-sm mt-0.5">
            {inscripcion?.carreras?.nombre_carrera ?? "Carrera asignada"} · Ciclo {cicloActual}
          </p>
        </div>
        <button onClick={fetchCursos} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4 bg-gradient-to-r from-[#8a2b1f] to-[#a93526] text-white border-0">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white/70 text-xs">Ciclo actual</p>
            <p className="text-3xl font-bold">{cicloActual}</p>
          </div>
        </div>
        <div className="card">
          <p className="text-xs text-mcm-muted">Cursos matriculados</p>
          <p className="text-2xl font-bold text-mcm-text mt-1">{cursos.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-mcm-muted">Créditos totales</p>
          <p className="text-2xl font-bold text-mcm-text mt-1">{totalCreditos}</p>
        </div>
        <div className="card">
          <p className="text-xs text-mcm-muted">Inicio de clases</p>
          {inscripcion?.fecha_inicio_ciclo ? (
            <>
              <p className="text-sm font-bold text-mcm-text mt-1">
                {new Date(inscripcion.fecha_inicio_ciclo).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
              {new Date(inscripcion.fecha_inicio_ciclo) > new Date() ? (
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

      {/* Lista de cursos */}
      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-mcm-border flex items-center gap-2">
          <BookOpen size={16} className="text-mcm-muted" />
          <h2 className="font-semibold text-mcm-text">Cursos del Ciclo {cicloActual}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Curso", "Créditos", "Estado"].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cursos.map(c => {
                const isFuture = inscripcion?.fecha_inicio_ciclo && new Date(inscripcion.fecha_inicio_ciclo) > new Date();
                const effectiveEstado = (c.estado === "en_curso" && isFuture) ? "programado" : c.estado;
                const badge: Record<string, string> = { programado: "badge-yellow", en_curso: "badge-blue", aprobado: "badge-green", desaprobado: "badge-red", retirado: "badge-gray" };
                const label: Record<string, string> = { programado: "Programado", en_curso: "En curso", aprobado: "Aprobado", desaprobado: "Desaprobado", retirado: "Retirado" };
                return (
                  <tr key={c.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-semibold text-mcm-text">{c.cursos?.nombre_curso}</td>
                    <td className="py-3.5 px-4 text-mcm-text">{c.cursos?.creditos}</td>
                    <td className="py-3.5 px-4">
                      <span className={badge[effectiveEstado] ?? "badge-gray"}>{label[effectiveEstado] ?? effectiveEstado}</span>
                    </td>
                  </tr>
                );
              })}
              {!cursos.length && (
                <tr><td colSpan={3} className="py-12 text-center text-mcm-muted text-sm">
                  No hay cursos asignados para este ciclo. Contacta a secretaría si crees que es un error.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de ciclos */}
      {historial.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-mcm-border flex items-center gap-2">
            <Clock size={16} className="text-mcm-muted" />
            <h2 className="font-semibold text-mcm-text">Historial de ciclos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Ciclo", "Inicio", "Fin", "Estado"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.map((h, i) => (
                  <tr key={i} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-mcm-text">Ciclo {h.ciclo}</td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">
                      {new Date(h.fecha_inicio).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">
                      {h.fecha_fin ? new Date(h.fecha_fin).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span className={h.estado === "completado" ? "badge-green" : h.estado === "activo" ? "badge-blue" : "badge-yellow"}>
                        {h.estado === "completado" ? "Completado" : h.estado === "activo" ? "En curso" : h.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
