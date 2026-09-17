"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import RouteGuard from "@/components/RouteGuard";
import {
  Loader2, Wallet, Search, RefreshCw, CalendarClock, GraduationCap, CheckCircle2,
} from "lucide-react";
import clsx from "clsx";

interface CuotaPendiente {
  concepto: string;
  amount: number;
  due_date: string | null;
  status: string;
}

interface AlumnoDeuda {
  alumno_id: string;
  nombre: string;
  carrera_id: string;
  carrera: string;
  ciclo_actual: number | null;
  cuotas: CuotaPendiente[];
  total_adeudado: number;
}

interface Resumen {
  total_alumnos: number;
  total_adeudado: number;
}

interface AlumnoOption {
  id: string;
  nombre: string;
  carrera_id: string;
  carrera: string;
  ciclo_actual: number | null;
}

interface CursoOption {
  id: string;
  nombre_curso: string;
  ciclo_perteneciente: number | null;
}

type TipoExamen = "sustitutorio" | "recuperacion" | "extraordinario";

const TIPOS_EXAMEN: { id: TipoExamen; label: string; monto: number }[] = [
  { id: "sustitutorio", label: "Examen sustitutorio", monto: 50 },
  { id: "recuperacion", label: "Examen de recuperación", monto: 80 },
  { id: "extraordinario", label: "Examen extraordinario", monto: 100 },
];

type Tab = "deudas" | "examenes";

const soles = (n: number) =>
  `S/ ${Number(n ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const d = new Date(fecha.length <= 10 ? fecha + "T00:00:00" : fecha);
  if (isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function statusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "vencido":
    case "overdue":
      return { label: "Vencido", className: "bg-red-100 text-red-700" };
    case "pending":
    case "pendiente":
      return { label: "Pendiente", className: "bg-amber-100 text-amber-700" };
    default:
      return { label: status, className: "bg-slate-100 text-slate-600" };
  }
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function CobranzaContent() {
  const [tab, setTab] = useState<Tab>("deudas");

  const [alumnos, setAlumnos] = useState<AlumnoDeuda[]>([]);
  const [resumen, setResumen] = useState<Resumen>({ total_alumnos: 0, total_adeudado: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filtros
  const [ciclo, setCiclo] = useState("");
  const [carreraId, setCarreraId] = useState("");

  // Opciones de filtro conocidas (acumuladas de las respuestas sin filtrar)
  const [carrerasOptions, setCarrerasOptions] = useState<{ id: string; nombre: string }[]>([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (ciclo) params.set("ciclo", ciclo);
      if (carreraId) params.set("carrera_id", carreraId);
      const qs = params.toString();
      const res = await fetch(`/api/admin/cobranza${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo cargar la cobranza");
      }
      const data: { alumnos: AlumnoDeuda[]; resumen: Resumen } = await res.json();
      setAlumnos(data.alumnos ?? []);
      setResumen(data.resumen ?? { total_alumnos: 0, total_adeudado: 0 });

      // Alimentar opciones de carrera cuando no hay filtro de carrera aplicado
      if (!carreraId) {
        const map = new Map<string, string>();
        for (const a of data.alumnos ?? []) {
          if (a.carrera_id) map.set(a.carrera_id, a.carrera);
        }
        if (map.size > 0) {
          setCarrerasOptions(
            [...map.entries()]
              .map(([id, nombre]) => ({ id, nombre }))
              .sort((x, y) => x.nombre.localeCompare(y.nombre))
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      setAlumnos([]);
      setResumen({ total_alumnos: 0, total_adeudado: 0 });
    } finally {
      setLoading(false);
    }
  }, [ciclo, carreraId]);

  useEffect(() => {
    if (tab === "deudas") cargar();
  }, [tab, cargar]);

  // Opciones de ciclo derivadas de los datos actuales
  const ciclosOptions = useMemo(() => {
    const set = new Set<number>();
    for (const a of alumnos) {
      if (a.ciclo_actual != null) set.add(a.ciclo_actual);
    }
    return [...set].sort((a, b) => a - b);
  }, [alumnos]);

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-mcm-text flex items-center gap-2">
          <Wallet size={24} className="text-[#C62828]" />
          Cobranza — Alumnos con deuda pendiente
        </h1>
        <p className="text-sm text-mcm-muted mt-1">
          Consulta las cuotas pendientes de los alumnos de carrera. Esta vista es solo de lectura:
          te ayuda a identificar quién debe y cuánto, con detalle por concepto y fecha de vencimiento.
        </p>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 border-b border-mcm-border">
        {([
          { id: "deudas", label: "Deudas", icon: Wallet },
          { id: "examenes", label: "Habilitar Examen", icon: GraduationCap },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "px-4 py-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5",
              tab === t.id
                ? "border-[#C62828] text-[#C62828]"
                : "border-transparent text-mcm-muted hover:text-mcm-text"
            )}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "deudas" ? (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="text-xs text-mcm-muted">Alumnos con deuda</p>
              <p className="text-2xl font-bold text-mcm-text mt-1">{resumen.total_alumnos}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-mcm-muted">Total adeudado</p>
              <p className="text-2xl font-bold text-[#C62828] mt-1">{soles(resumen.total_adeudado)}</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-mcm-muted mb-1">Ciclo</label>
                <select
                  value={ciclo}
                  onChange={(e) => setCiclo(e.target.value)}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none"
                >
                  <option value="">Todos los ciclos</option>
                  {ciclosOptions.map((c) => (
                    <option key={c} value={c}>Ciclo {c}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-mcm-muted mb-1">Carrera</label>
                <select
                  value={carreraId}
                  onChange={(e) => setCarreraId(e.target.value)}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none"
                >
                  <option value="">Todas las carreras</option>
                  {carrerasOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={cargar}
                className="btn-primary flex items-center justify-center gap-2 text-sm"
              >
                <RefreshCw size={14} /> Actualizar
              </button>
            </div>
          </div>

          {/* Contenido */}
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted">
              <Loader2 size={20} className="animate-spin" /> Cargando...
            </div>
          ) : error ? (
            <div className="card p-6 text-center text-red-600 text-sm">{error}</div>
          ) : alumnos.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                <Search className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-mcm-text font-semibold">No hay alumnos con deuda pendiente</p>
              <p className="text-mcm-muted text-sm mt-1">
                Con los filtros aplicados no se encontraron cuotas por cobrar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alumnos.map((a) => (
                <div key={a.alumno_id} className="card p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-mcm-text truncate">{a.nombre}</p>
                      <p className="text-xs text-mcm-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <GraduationCap size={13} /> {a.carrera}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock size={13} /> Ciclo {a.ciclo_actual ?? "—"}
                        </span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-mcm-muted">Total adeudado</p>
                      <p className="text-xl font-bold text-[#C62828]">{soles(a.total_adeudado)}</p>
                    </div>
                  </div>

                  {/* Detalle de cuotas */}
                  <div className="mt-3 border-t border-mcm-border pt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-mcm-muted">
                          <th className="py-1.5 pr-4 font-semibold">Concepto</th>
                          <th className="py-1.5 pr-4 font-semibold">Vencimiento</th>
                          <th className="py-1.5 pr-4 font-semibold">Estado</th>
                          <th className="py-1.5 text-right font-semibold">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.cuotas.map((c, i) => {
                          const badge = statusBadge(c.status);
                          return (
                            <tr key={`${a.alumno_id}-${i}`} className="border-t border-mcm-border/60">
                              <td className="py-2 pr-4 text-mcm-text">{c.concepto}</td>
                              <td className="py-2 pr-4 text-mcm-muted">{formatFecha(c.due_date)}</td>
                              <td className="py-2 pr-4">
                                <span className={clsx("inline-block px-2 py-0.5 rounded-full text-xs font-medium", badge.className)}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="py-2 text-right font-medium text-mcm-text">{soles(c.amount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <ExamenesTab />
      )}
    </div>
  );
}

function ExamenesTab() {
  const [alumnos, setAlumnos] = useState<AlumnoOption[]>([]);
  const [loadingAlumnos, setLoadingAlumnos] = useState(true);
  const [alumnosError, setAlumnosError] = useState("");

  const [alumnoId, setAlumnoId] = useState("");
  const [cursos, setCursos] = useState<CursoOption[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [cursoId, setCursoId] = useState("");
  const [tipoExamen, setTipoExamen] = useState<TipoExamen | "">("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const alumnoSel = useMemo(
    () => alumnos.find((a) => a.id === alumnoId) ?? null,
    [alumnos, alumnoId]
  );

  // Cargar alumnos de carrera regular
  useEffect(() => {
    (async () => {
      setLoadingAlumnos(true);
      setAlumnosError("");
      try {
        const token = await getToken();
        const res = await fetch("/api/admin/examenes", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "No se pudieron cargar los alumnos");
        }
        const data: { alumnos: AlumnoOption[] } = await res.json();
        setAlumnos(data.alumnos ?? []);
      } catch (e) {
        setAlumnosError(e instanceof Error ? e.message : "Error al cargar alumnos");
      } finally {
        setLoadingAlumnos(false);
      }
    })();
  }, []);

  // Cargar cursos de la malla al cambiar de alumno
  useEffect(() => {
    setCursoId("");
    setCursos([]);
    if (!alumnoSel?.carrera_id) return;
    (async () => {
      setLoadingCursos(true);
      try {
        const token = await getToken();
        const res = await fetch(
          `/api/admin/examenes?cursos_carrera_id=${encodeURIComponent(alumnoSel.carrera_id)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "No se pudieron cargar los cursos");
        }
        const data: { cursos: CursoOption[] } = await res.json();
        setCursos(data.cursos ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar cursos");
      } finally {
        setLoadingCursos(false);
      }
    })();
  }, [alumnoSel?.carrera_id]);

  const handleAlumnoChange = (id: string) => {
    setAlumnoId(id);
    setError("");
    setSuccess("");
  };

  const puedeEnviar = alumnoId && cursoId && tipoExamen && !submitting;

  const handleSubmit = async () => {
    if (!alumnoId || !cursoId || !tipoExamen) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const curso = cursos.find((c) => c.id === cursoId);
      const token = await getToken();
      const res = await fetch("/api/admin/examenes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          alumno_id: alumnoId,
          curso_id: cursoId,
          curso_nombre: curso?.nombre_curso ?? "",
          tipo_examen: tipoExamen,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo habilitar el examen");
      }
      setSuccess(data.message ?? "Examen habilitado correctamente.");
      // Limpiar el formulario (mantener el alumno seleccionado para varios cargos rápidos)
      setCursoId("");
      setTipoExamen("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al habilitar el examen");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card p-5 space-y-5 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-mcm-text flex items-center gap-2">
          <GraduationCap size={18} className="text-[#C62828]" />
          Habilitar examen de pago
        </h2>
        <p className="text-sm text-mcm-muted mt-1">
          Selecciona al alumno, el curso y el tipo de examen. Se generará un cargo que el alumno
          verá en su estado de cuenta para pagarlo como cualquier otra cuota.
        </p>
      </div>

      {alumnosError ? (
        <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{alumnosError}</div>
      ) : null}

      {/* Alumno */}
      <div>
        <label className="block text-xs font-semibold text-mcm-muted mb-1">Alumno</label>
        <select
          value={alumnoId}
          onChange={(e) => handleAlumnoChange(e.target.value)}
          disabled={loadingAlumnos}
          className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none disabled:bg-slate-50"
        >
          <option value="">{loadingAlumnos ? "Cargando alumnos..." : "Selecciona un alumno"}</option>
          {alumnos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre} — {a.carrera} (Ciclo {a.ciclo_actual ?? "—"})
            </option>
          ))}
        </select>
      </div>

      {/* Curso */}
      <div>
        <label className="block text-xs font-semibold text-mcm-muted mb-1">Curso</label>
        <select
          value={cursoId}
          onChange={(e) => { setCursoId(e.target.value); setError(""); setSuccess(""); }}
          disabled={!alumnoId || loadingCursos}
          className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none disabled:bg-slate-50"
        >
          <option value="">
            {!alumnoId
              ? "Primero selecciona un alumno"
              : loadingCursos
                ? "Cargando cursos..."
                : cursos.length === 0
                  ? "No hay cursos en la malla"
                  : "Selecciona un curso"}
          </option>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre_curso}{c.ciclo_perteneciente != null ? ` (Ciclo ${c.ciclo_perteneciente})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Tipo de examen */}
      <div>
        <label className="block text-xs font-semibold text-mcm-muted mb-1">Tipo de examen</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TIPOS_EXAMEN.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTipoExamen(t.id); setError(""); setSuccess(""); }}
              className={clsx(
                "border rounded-lg px-3 py-3 text-left transition-colors",
                tipoExamen === t.id
                  ? "border-[#C62828] bg-red-50"
                  : "border-mcm-border hover:border-[#C62828]/50"
              )}
            >
              <p className="text-sm font-semibold text-mcm-text">{t.label}</p>
              <p className="text-xs text-mcm-muted mt-0.5">{soles(t.monto)}</p>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2 flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      <div className="pt-1">
        <button
          onClick={handleSubmit}
          disabled={!puedeEnviar}
          className="btn-primary flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <GraduationCap size={15} />}
          Habilitar examen
        </button>
      </div>
    </div>
  );
}

export default function CobranzaPage() {
  return (
    <RouteGuard allowedRoles={["super_admin", "secretaria_atencion_academica"]}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted">
            <Loader2 size={20} className="animate-spin" /> Cargando...
          </div>
        }
      >
        <CobranzaContent />
      </Suspense>
    </RouteGuard>
  );
}
