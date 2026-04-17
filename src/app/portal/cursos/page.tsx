"use client";

import { useEffect, useState, useReducer } from "react";
import { supabase } from "@/lib/supabase";
import { BookOpen, Clock, TrendingUp, Loader2, RefreshCw, AlertCircle } from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface Inscripcion {
  ciclo_actual: number;
  fecha_inicio_ciclo: string;
  estado: string;
  carreras: { nombre_carrera: string; duracion_ciclos: number };
}
interface AlumnoCurso {
  id: string; ciclo: number; estado: string;
  cursos: { nombre_curso: string; creditos: number };
}
interface HistorialCiclo {
  ciclo: number; fecha_inicio: string; fecha_fin: string | null; estado: string;
}

/* ─── State machine — impossible to get stuck ──────────────────────────────── */

type State = {
  status: "idle" | "loading" | "ready" | "error";
  inscripcion: Inscripcion | null;
  cursos: AlumnoCurso[];
  historial: HistorialCiclo[];
  errorMsg: string;
};

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_OK"; inscripcion: Inscripcion | null; cursos: AlumnoCurso[]; historial: HistorialCiclo[] }
  | { type: "FETCH_ERROR"; msg: string }
  | { type: "BG_REFRESH_OK"; inscripcion: Inscripcion | null; cursos: AlumnoCurso[]; historial: HistorialCiclo[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      // Only show loading if we have no data yet
      return state.status === "ready"
        ? state // Keep showing existing data during background refresh
        : { ...state, status: "loading" };
    case "FETCH_OK":
      return { status: "ready", inscripcion: action.inscripcion, cursos: action.cursos, historial: action.historial, errorMsg: "" };
    case "BG_REFRESH_OK":
      return { status: "ready", inscripcion: action.inscripcion, cursos: action.cursos, historial: action.historial, errorMsg: "" };
    case "FETCH_ERROR":
      // If we already have data, keep it visible
      return state.status === "ready"
        ? state
        : { ...state, status: "error", errorMsg: action.msg };
    default:
      return state;
  }
}

const initialState: State = {
  status: "idle", inscripcion: null, cursos: [], historial: [], errorMsg: "",
};

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function CursosAlumnoPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [fetchId, setFetchId] = useState(0); // Increment to trigger a new fetch

  // Single effect that fetches data whenever fetchId changes
  useEffect(() => {
    let cancelled = false;

    async function doFetch() {
      dispatch({ type: "FETCH_START" });

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        const token = session?.access_token;
        if (!token) {
          dispatch({ type: "FETCH_ERROR", msg: "Sesión no disponible. Recarga la página." });
          return;
        }

        const res = await fetch("/api/portal/mis-cursos", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          dispatch({ type: "FETCH_ERROR", msg: body.error ?? `Error ${res.status}` });
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        const actionType = state.status === "ready" ? "BG_REFRESH_OK" : "FETCH_OK";
        dispatch({
          type: actionType,
          inscripcion: data.inscripcion,
          cursos: data.cursos ?? [],
          historial: data.historial ?? [],
        });
      } catch (err) {
        if (cancelled) return;
        dispatch({ type: "FETCH_ERROR", msg: err instanceof Error ? err.message : "Error de red" });
      }
    }

    doFetch();
    return () => { cancelled = true; };
  }, [fetchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // On tab focus: trigger background refresh (only if we already have data)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && state.status === "ready") {
        setFetchId(n => n + 1);
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [state.status]);

  /* ─── Render ─────────────────────────────────────────────────────────────── */

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh] gap-3 text-mcm-muted">
        <Loader2 size={20} className="animate-spin" /> <span className="text-sm">Cargando cursos...</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card text-center py-12">
          <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
          <h2 className="font-bold text-mcm-text text-lg mb-1">Error al cargar cursos</h2>
          <p className="text-mcm-muted text-sm mb-4">{state.errorMsg}</p>
          <button onClick={() => setFetchId(n => n + 1)} className="btn-primary text-sm">Reintentar</button>
        </div>
      </div>
    );
  }

  const { inscripcion, cursos, historial } = state;

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
        <button onClick={() => setFetchId(n => n + 1)} className="btn-secondary flex items-center gap-2 text-sm">
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

      {/* Historial */}
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
