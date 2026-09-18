"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import RouteGuard from "@/components/RouteGuard";
import {
  Loader2, Wallet, Search, RefreshCw, CalendarClock, GraduationCap, CheckCircle2,
  ChevronDown, AlertTriangle,
} from "lucide-react";
import clsx from "clsx";

interface CuotaPendiente {
  concepto: string;
  amount: number;
  due_date: string | null;
  status: string;
  vencida: boolean;
}

interface AlumnoDeuda {
  alumno_id: string;
  nombre: string;
  carrera_id: string;
  carrera: string;
  ciclo_actual: number | null;
  cuotas: CuotaPendiente[];
  total_adeudado: number;
  total_vencido: number;
}

interface Resumen {
  total_alumnos: number;
  total_adeudado: number;
  total_vencido: number;
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
  const [resumen, setResumen] = useState<Resumen>({ total_alumnos: 0, total_adeudado: 0, total_vencido: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Estado de expansión por alumno (acordeón). Por defecto todos colapsados.
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const toggleExpandido = (id: string) =>
    setExpandido((prev) => ({ ...prev, [id]: !prev[id] }));

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
      setResumen(data.resumen ?? { total_alumnos: 0, total_adeudado: 0, total_vencido: 0 });
      setExpandido({}); // colapsar todo al recargar

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
      setResumen({ total_alumnos: 0, total_adeudado: 0, total_vencido: 0 });
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

  // Agrupar alumnos por ciclo (ascendente). Dentro de cada ciclo, mayor vencido primero.
  const gruposPorCiclo = useMemo(() => {
    const map = new Map<number, AlumnoDeuda[]>();
    for (const a of alumnos) {
      const key = a.ciclo_actual ?? -1; // -1 = sin ciclo, se muestra al final
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return [...map.entries()]
      .sort(([x], [y]) => {
        if (x === -1) return 1;
        if (y === -1) return -1;
        return x - y;
      })
      .map(([ciclo, lista]) => ({
        ciclo,
        alumnos: [...lista].sort((a, b) => b.total_vencido - a.total_vencido),
        total_vencido: lista.reduce((acc, a) => acc + a.total_vencido, 0),
      }));
  }, [alumnos]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-2 space-y-5">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-mcm-text flex items-center gap-2">
          <Wallet size={24} className="text-[#C62828]" />
          Cobranza — Alumnos con deuda vencida
        </h1>
        <p className="text-sm text-mcm-muted mt-1">
          Consulta las cuotas vencidas de los alumnos de carrera. Esta vista es solo de lectura:
          te ayuda a identificar quién tiene deuda vencida y cuánto, agrupado por ciclo y con detalle
          por concepto y fecha de vencimiento.
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
              <p className="text-xs text-mcm-muted">Alumnos con deuda vencida</p>
              <p className="text-2xl font-bold text-mcm-text mt-1">{resumen.total_alumnos}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-mcm-muted">Total vencido</p>
              <p className="text-2xl font-bold text-[#C62828] mt-1">{soles(resumen.total_vencido)}</p>
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
              <p className="text-mcm-text font-semibold">No hay alumnos con deuda vencida</p>
              <p className="text-mcm-muted text-sm mt-1">
                Con los filtros aplicados no se encontraron cuotas vencidas por cobrar.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {gruposPorCiclo.map((grupo) => (
                <section key={grupo.ciclo}>
                  {/* Encabezado de ciclo */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2 px-1">
                    <h2 className="text-sm font-bold text-mcm-text flex items-center gap-1.5">
                      <CalendarClock size={15} className="text-[#C62828]" />
                      {grupo.ciclo === -1 ? "Sin ciclo asignado" : `Ciclo ${grupo.ciclo}`}
                      <span className="font-normal text-mcm-muted">
                        — {grupo.alumnos.length} alumno{grupo.alumnos.length === 1 ? "" : "s"} con deuda vencida
                      </span>
                    </h2>
                    <p className="text-xs text-mcm-muted">
                      Total vencido <span className="font-semibold text-[#C62828]">{soles(grupo.total_vencido)}</span>
                    </p>
                  </div>

                  {/* Lista de alumnos (acordeón) */}
                  <div className="space-y-2">
                    {grupo.alumnos.map((a) => {
                      const abierto = !!expandido[a.alumno_id];
                      // Vencidas primero, luego futuras
                      const cuotasOrdenadas = [...a.cuotas].sort(
                        (x, y) => Number(y.vencida) - Number(x.vencida)
                      );
                      return (
                        <div key={a.alumno_id} className="card overflow-hidden">
                          {/* Cabecera colapsable */}
                          <button
                            type="button"
                            onClick={() => toggleExpandido(a.alumno_id)}
                            aria-expanded={abierto}
                            className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <ChevronDown
                                size={18}
                                className={clsx(
                                  "shrink-0 text-mcm-muted transition-transform",
                                  abierto && "rotate-180"
                                )}
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-mcm-text truncate">{a.nombre}</p>
                                <p className="text-xs text-mcm-muted mt-0.5 inline-flex items-center gap-1">
                                  <GraduationCap size={13} /> {a.carrera}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-mcm-muted">Total vencido</p>
                              <p className="text-xl font-bold text-[#C62828]">{soles(a.total_vencido)}</p>
                            </div>
                          </button>

                          {/* Detalle de cuotas */}
                          {abierto && (
                            <div className="border-t border-mcm-border px-4 py-3 overflow-x-auto">
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
                                  {cuotasOrdenadas.map((c, i) => {
                                    const badge = statusBadge(c.status);
                                    return (
                                      <tr
                                        key={`${a.alumno_id}-${i}`}
                                        className={clsx(
                                          "border-t border-mcm-border/60",
                                          c.vencida ? "bg-red-50/60" : "text-mcm-muted"
                                        )}
                                      >
                                        <td className={clsx("py-2 pr-4", c.vencida ? "text-mcm-text font-medium" : "")}>
                                          {c.concepto}
                                        </td>
                                        <td className="py-2 pr-4">{formatFecha(c.due_date)}</td>
                                        <td className="py-2 pr-4">
                                          {c.vencida ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                              <AlertTriangle size={12} /> Vencido
                                            </span>
                                          ) : (
                                            <span className={clsx("inline-block px-2 py-0.5 rounded-full text-xs font-medium", badge.className)}>
                                              {badge.label}
                                            </span>
                                          )}
                                        </td>
                                        <td className={clsx("py-2 text-right font-medium", c.vencida ? "text-[#C62828]" : "")}>
                                          {soles(c.amount)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
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
  // Datos base
  const [carreras, setCarreras] = useState<{ id: string; nombre: string }[]>([]);
  const [alumnos, setAlumnos] = useState<AlumnoOption[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [baseError, setBaseError] = useState("");

  // Selección en cascada
  const [carreraId, setCarreraId] = useState("");
  const [ciclo, setCiclo] = useState("");
  const [alumnoId, setAlumnoId] = useState("");
  const [cursos, setCursos] = useState<CursoOption[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [cursoId, setCursoId] = useState("");
  const [tipoExamen, setTipoExamen] = useState<TipoExamen | "">("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clearMsgs = () => { setError(""); setSuccess(""); };

  const alumnoSel = useMemo(
    () => alumnos.find((a) => a.id === alumnoId) ?? null,
    [alumnos, alumnoId]
  );

  // Ciclos disponibles para la carrera seleccionada (derivados de alumnos reales)
  const ciclosOptions = useMemo(() => {
    if (!carreraId) return [];
    const set = new Set<number>();
    for (const a of alumnos) {
      if (a.carrera_id === carreraId && a.ciclo_actual != null) set.add(a.ciclo_actual);
    }
    return [...set].sort((a, b) => a - b);
  }, [alumnos, carreraId]);

  // Alumnos de la carrera + ciclo seleccionados
  const alumnosFiltrados = useMemo(() => {
    if (!carreraId || !ciclo) return [];
    const cicloNum = Number(ciclo);
    return alumnos
      .filter((a) => a.carrera_id === carreraId && a.ciclo_actual === cicloNum)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [alumnos, carreraId, ciclo]);

  // Cursos del ciclo seleccionado (la malla trae los 6 ciclos; mostramos solo el actual)
  const cursosFiltrados = useMemo(() => {
    if (!ciclo) return [];
    const cicloNum = Number(ciclo);
    return cursos.filter((c) => Number(c.ciclo_perteneciente) === cicloNum);
  }, [cursos, ciclo]);

  // Cargar carreras + alumnos (una sola vez)
  useEffect(() => {
    (async () => {
      setLoadingBase(true);
      setBaseError("");
      try {
        const token = await getToken();
        const [carrerasRes, alumnosRes] = await Promise.all([
          fetch("/api/admin/examenes?carreras=1", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/admin/examenes", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!carrerasRes.ok) {
          const d = await carrerasRes.json().catch(() => ({}));
          throw new Error(d.error ?? "No se pudieron cargar las carreras");
        }
        if (!alumnosRes.ok) {
          const d = await alumnosRes.json().catch(() => ({}));
          throw new Error(d.error ?? "No se pudieron cargar los alumnos");
        }
        const carrerasData: { carreras: { id: string; nombre: string }[] } = await carrerasRes.json();
        const alumnosData: { alumnos: AlumnoOption[] } = await alumnosRes.json();
        setCarreras(carrerasData.carreras ?? []);
        setAlumnos(alumnosData.alumnos ?? []);
      } catch (e) {
        setBaseError(e instanceof Error ? e.message : "Error al cargar datos");
      } finally {
        setLoadingBase(false);
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

  // Handlers de cascada: al cambiar un nivel, resetear los siguientes
  const handleCarreraChange = (id: string) => {
    setCarreraId(id);
    setCiclo("");
    setAlumnoId("");
    setCursoId("");
    setTipoExamen("");
    clearMsgs();
  };
  const handleCicloChange = (c: string) => {
    setCiclo(c);
    setAlumnoId("");
    setCursoId("");
    setTipoExamen("");
    clearMsgs();
  };
  const handleAlumnoChange = (id: string) => {
    setAlumnoId(id);
    setCursoId("");
    setTipoExamen("");
    clearMsgs();
  };

  const puedeEnviar = alumnoId && cursoId && tipoExamen && !submitting;

  const handleSubmit = async () => {
    if (!alumnoId || !cursoId || !tipoExamen) return;
    setSubmitting(true);
    clearMsgs();
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
      // Limpiar solo curso/tipo (mantener carrera/ciclo/alumno para cargos rápidos)
      setCursoId("");
      setTipoExamen("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al habilitar el examen");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card p-5 sm:p-6 space-y-5 max-w-2xl mx-auto">
      <div>
        <h2 className="text-lg font-semibold text-mcm-text flex items-center gap-2">
          <GraduationCap size={18} className="text-[#C62828]" />
          Habilitar examen de pago
        </h2>
        <p className="text-sm text-mcm-muted mt-1">
          Elige carrera, ciclo, alumno, curso y tipo de examen. Se generará un cargo que el alumno
          verá en su estado de cuenta para pagarlo como cualquier otra cuota.
        </p>
      </div>

      {baseError ? (
        <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{baseError}</div>
      ) : null}

      {/* 1. Carrera */}
      <div>
        <label className="block text-xs font-semibold text-mcm-muted mb-1">1. Carrera</label>
        <select
          value={carreraId}
          onChange={(e) => handleCarreraChange(e.target.value)}
          disabled={loadingBase}
          className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none disabled:bg-slate-50"
        >
          <option value="">{loadingBase ? "Cargando carreras..." : "Selecciona una carrera"}</option>
          {carreras.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {/* 2. Ciclo */}
      <div>
        <label className="block text-xs font-semibold text-mcm-muted mb-1">2. Ciclo</label>
        <select
          value={ciclo}
          onChange={(e) => handleCicloChange(e.target.value)}
          disabled={!carreraId}
          className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none disabled:bg-slate-50"
        >
          <option value="">
            {!carreraId
              ? "Primero selecciona una carrera"
              : ciclosOptions.length === 0
                ? "No hay ciclos con alumnos"
                : "Selecciona un ciclo"}
          </option>
          {ciclosOptions.map((c) => (
            <option key={c} value={c}>Ciclo {c}</option>
          ))}
        </select>
      </div>

      {/* 3. Alumno */}
      <div>
        <label className="block text-xs font-semibold text-mcm-muted mb-1">3. Alumno</label>
        <select
          value={alumnoId}
          onChange={(e) => handleAlumnoChange(e.target.value)}
          disabled={!carreraId || !ciclo}
          className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none disabled:bg-slate-50"
        >
          <option value="">
            {!carreraId || !ciclo
              ? "Primero selecciona carrera y ciclo"
              : alumnosFiltrados.length === 0
                ? "No hay alumnos en este ciclo"
                : "Selecciona un alumno"}
          </option>
          {alumnosFiltrados.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>
      </div>

      {/* 4. Curso */}
      <div>
        <label className="block text-xs font-semibold text-mcm-muted mb-1">4. Curso</label>
        <select
          value={cursoId}
          onChange={(e) => { setCursoId(e.target.value); clearMsgs(); }}
          disabled={!alumnoId || loadingCursos}
          className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none disabled:bg-slate-50"
        >
          <option value="">
            {!alumnoId
              ? "Primero selecciona un alumno"
              : loadingCursos
                ? "Cargando cursos..."
                : cursosFiltrados.length === 0
                  ? "No hay cursos para este ciclo"
                  : "Selecciona un curso"}
          </option>
          {cursosFiltrados.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre_curso}{c.ciclo_perteneciente != null ? ` (Ciclo ${c.ciclo_perteneciente})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* 5. Tipo de examen */}
      <div>
        <label className="block text-xs font-semibold text-mcm-muted mb-1">5. Tipo de examen</label>
        <div className={clsx("grid grid-cols-1 sm:grid-cols-3 gap-2", !cursoId && "opacity-50 pointer-events-none")}>
          {TIPOS_EXAMEN.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!cursoId}
              onClick={() => { setTipoExamen(t.id); clearMsgs(); }}
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
