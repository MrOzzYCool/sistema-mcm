"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import RouteGuard from "@/components/RouteGuard";
import {
  Loader2, Plus, Calendar, Clock, X, RefreshCw, CheckCircle,
  AlertCircle, Trash2, Save, Pencil,
} from "lucide-react";
import clsx from "clsx";

interface CycleOpening {
  id: string; cycle_number: number; start_date: string; fecha_fin: string | null; status: string; created_at: string;
}
interface Schedule {
  id: string; professor_id: string; course_id: string; cycle_number: number;
  day_of_week: number; start_time: string; end_time: string;
  duration_minutes: number; location: string | null;
  start_date: string; end_date: string;
  // Campos de compatibilidad agregados por el GET
  dia_semana: string; hora_inicio: string; hora_fin: string; aula: string | null; ciclo: number;
  profiles: { nombre_completo: string };
  cursos: { nombre_curso: string };
}
interface Profesor { id: string; nombre_completo: string; }
interface Curso { id: string; nombre_curso: string; ciclo_perteneciente: number; malla_curricular?: { carrera_id: string }[]; }
interface Carrera { id: string; nombre_carrera: string; }

// ─── Combobox de Profesor (buscador predictivo) ─────────────────────────────

function ProfesorCombobox({
  value,
  onChange,
  profesores,
}: {
  value: string;
  onChange: (id: string) => void;
  profesores: Profesor[];
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = profesores.find(p => p.id === value);
  const filtered = profesores.filter(p =>
    p.nombre_completo.toLowerCase().includes(search.toLowerCase())
  );

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={open ? search : (selected?.nombre_completo ?? "")}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setSearch(""); }}
        placeholder="Buscar profesor..."
        className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526] focus:outline-none"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-mcm-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-mcm-muted">No se encontraron resultados</div>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.id); setSearch(""); setOpen(false); }}
                className={clsx(
                  "w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors",
                  p.id === value && "bg-blue-50 text-blue-700 font-medium"
                )}
              >
                {p.nombre_completo}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function CiclosContent() {
  const { user } = useAuth();
  const canDelete = user?.role && ["super_admin"].includes(user.role);

  const [tab, setTab] = useState<"aperturas" | "horarios">("aperturas");
  const [openings, setOpenings] = useState<CycleOpening[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modals
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editOpeningModal, setEditOpeningModal] = useState<{ show: boolean; target: CycleOpening | null }>({ show: false, target: null });
  const [editOpeningForm, setEditOpeningForm] = useState({ cycle_number: "1", start_date: "", fecha_fin: "" });
  const [editScheduleModal, setEditScheduleModal] = useState<{ show: boolean; target: Schedule | null }>({ show: false, target: null });
  const [editScheduleForm, setEditScheduleForm] = useState({
    profesor_id: "", carrera_id: "", curso_id: "", ciclo: "1",
    dia_semana: "lunes", hora_inicio: "18:00", hora_fin: "20:00", aula: "",
  });
  const [saving, setSaving] = useState(false);

  // Forms
  const [openingForm, setOpeningForm] = useState({ cycle_number: "1", start_date: "", fecha_fin: "" });
  const [scheduleForm, setScheduleForm] = useState({
    profesor_id: "", carrera_id: "", curso_id: "", ciclo: "1",
    dia_semana: "lunes", hora_inicio: "18:00", hora_fin: "20:00", aula: "",
  });
  const [filterCiclo, setFilterCiclo] = useState("todos");

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [resO, resS, resP, resC, resCarreras] = await Promise.all([
        fetch("/api/admin/cycle-openings", { headers }),
        fetch("/api/admin/schedules", { headers }),
        fetch("/api/admin/users", { headers }),
        fetch("/api/admin/academico?tipo=cursos", { headers }),
        fetch("/api/admin/academico", { headers }),
      ]);

      if (resO.ok) setOpenings((await resO.json()).openings ?? []);
      if (resS.ok) setSchedules((await resS.json()).schedules ?? []);
      if (resP.ok) {
        const users = await resP.json();
        setProfesores(users.filter((u: { rol: string }) => u.rol === "profesor"));
      }
      if (resC.ok) setCursos(await resC.json());
      if (resCarreras.ok) setCarreras(await resCarreras.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleCreateOpening() {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/admin/cycle-openings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({
          cycle_number: parseInt(openingForm.cycle_number),
          start_date: openingForm.start_date,
          fecha_fin: openingForm.fecha_fin || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSuccess(`Ciclo ${openingForm.cycle_number} aperturado.`);
      setShowOpeningModal(false);
      cargar();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setSaving(false); }
  }

  async function handleCreateSchedule() {
    if (!scheduleForm.curso_id) {
      setError("Debes seleccionar un curso antes de crear el horario.");
      return;
    }
    if (!scheduleForm.profesor_id) {
      setError("Debes seleccionar un profesor.");
      return;
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      console.log("[handleCreateSchedule] Enviando:", scheduleForm);
      const res = await fetch("/api/admin/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({
          profesor_id: scheduleForm.profesor_id,
          curso_id: scheduleForm.curso_id,
          ciclo: scheduleForm.ciclo,
          dia_semana: scheduleForm.dia_semana,
          hora_inicio: scheduleForm.hora_inicio,
          hora_fin: scheduleForm.hora_fin,
          aula: scheduleForm.aula || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSuccess("Horario creado.");
      setShowScheduleModal(false);
      cargar();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setSaving(false); }
  }

  async function handleDeleteSchedule(id: string) {
    if (!confirm("¿Eliminar este horario?")) return;
    try {
      const res = await fetch("/api/admin/schedules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ schedule_id: id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      cargar();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  function openEditSchedule(s: Schedule) {
    setEditScheduleForm({
      profesor_id: s.professor_id,
      carrera_id: "",
      curso_id: s.course_id,
      ciclo: String(s.cycle_number),
      dia_semana: s.dia_semana,
      hora_inicio: s.hora_inicio?.slice(0, 5) ?? "18:00",
      hora_fin: s.hora_fin?.slice(0, 5) ?? "20:00",
      aula: s.aula ?? "",
    });
    setEditScheduleModal({ show: true, target: s });
  }

  async function handleEditSchedule() {
    if (!editScheduleModal.target) return;
    if (!editScheduleForm.profesor_id || !editScheduleForm.curso_id) {
      setError("Profesor y Curso son obligatorios.");
      return;
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/admin/schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({
          schedule_id: editScheduleModal.target.id,
          profesor_id: editScheduleForm.profesor_id,
          curso_id: editScheduleForm.curso_id,
          ciclo: editScheduleForm.ciclo,
          dia_semana: editScheduleForm.dia_semana,
          hora_inicio: editScheduleForm.hora_inicio,
          hora_fin: editScheduleForm.hora_fin,
          aula: editScheduleForm.aula || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSuccess("Horario actualizado.");
      setEditScheduleModal({ show: false, target: null });
      cargar();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setSaving(false); }
  }

  async function handleDeleteOpening(id: string, cycleNumber: number) {
    if (!confirm(`¿Estás seguro de eliminar la apertura del Ciclo ${cycleNumber}? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch("/api/admin/cycle-openings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSuccess(`Apertura del Ciclo ${cycleNumber} eliminada.`);
      cargar();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  function openEditOpening(o: CycleOpening) {
    setEditOpeningForm({
      cycle_number: String(o.cycle_number),
      start_date: o.start_date,
      fecha_fin: o.fecha_fin ?? "",
    });
    setEditOpeningModal({ show: true, target: o });
  }

  async function handleEditOpening() {
    if (!editOpeningModal.target) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/admin/cycle-openings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({
          id: editOpeningModal.target.id,
          cycle_number: parseInt(editOpeningForm.cycle_number),
          start_date: editOpeningForm.start_date,
          fecha_fin: editOpeningForm.fecha_fin || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSuccess("Apertura actualizada.");
      setEditOpeningModal({ show: false, target: null });
      cargar();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setSaving(false); }
  }

  const DAYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const DAY_LABELS: Record<string, string> = { lunes: "Lun", martes: "Mar", miercoles: "Mié", jueves: "Jue", viernes: "Vie", sabado: "Sáb" };

  const filteredSchedules = filterCiclo === "todos"
    ? schedules
    : schedules.filter(s => s.cycle_number === parseInt(filterCiclo));

  return (
    <div className="p-6 w-full space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Gestión de Ciclos y Horarios</h1>
          <p className="text-mcm-muted text-sm">{openings.length} aperturas · {schedules.length} horarios</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "aperturas" && (
            <button onClick={() => setShowOpeningModal(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Aperturar Ciclo
            </button>
          )}
          {tab === "horarios" && (
            <button onClick={() => setShowScheduleModal(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Nuevo Horario
            </button>
          )}
          <button onClick={cargar} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm flex items-center gap-2"><AlertCircle size={16} />{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm flex items-center gap-2"><CheckCircle size={16} />{success}</div>}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-mcm-border">
        {(["aperturas", "horarios"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx("px-4 py-2 text-sm font-semibold border-b-2 transition-colors capitalize",
              tab === t ? "border-[#a93526] text-[#a93526]" : "border-transparent text-mcm-muted hover:text-mcm-text")}>
            {t === "aperturas" ? <><Calendar size={14} className="inline mr-1" />Aperturas</> : <><Clock size={14} className="inline mr-1" />Horarios</>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted"><Loader2 size={20} className="animate-spin" /> Cargando...</div>
      ) : tab === "aperturas" ? (
        /* ── Aperturas ── */
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>{["Ciclo", "Fecha de Inicio", "Fecha de Culminación", "Estado", "Creado", ...(canDelete ? ["Acciones"] : [])].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {openings.map(o => (
                  <tr key={o.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-mcm-text">Ciclo {o.cycle_number}</td>
                    <td className="py-3 px-4">{new Date(o.start_date + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}</td>
                    <td className="py-3 px-4">{o.fecha_fin ? new Date(o.fecha_fin + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</td>
                    <td className="py-3 px-4"><span className={o.status === "activo" ? "badge-green" : "badge-gray"}>{o.status}</span></td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">{new Date(o.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}</td>
                    {canDelete && (
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button onClick={() => openEditOpening(o)} title="Editar apertura"
                            className="text-mcm-muted hover:text-[#a93526]"><Pencil size={14} /></button>
                          <button onClick={() => handleDeleteOpening(o.id, o.cycle_number)} title="Eliminar apertura"
                            className="text-mcm-muted hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {!openings.length && <tr><td colSpan={canDelete ? 6 : 5} className="py-12 text-center text-mcm-muted text-sm">No hay aperturas de ciclo</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── Horarios ── */
        <>
          <div className="flex gap-2 items-center">
            {["todos", "1", "2", "3", "4", "5", "6"].map(c => (
              <button key={c} onClick={() => setFilterCiclo(c)}
                className={clsx("px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                  filterCiclo === c ? "bg-[#a93526] text-white" : "bg-slate-100 text-mcm-muted hover:bg-slate-200")}>
                {c === "todos" ? "Todos" : `Ciclo ${c}`}
              </button>
            ))}
          </div>

          {/* Weekly grid view */}
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              {(() => {
                const HOURS = ["18:00", "19:00", "20:00", "21:00", "22:00"];
                const HOUR_HEIGHT = 80; // px por hora
                const START_HOUR = 18;
                const TOTAL_HOURS = HOURS.length;

                function getTop(time: string): number {
                  const [h, m] = time.split(":").map(Number);
                  return ((h - START_HOUR) + m / 60) * HOUR_HEIGHT;
                }
                function getHeight(start: string, end: string): number {
                  const [sh, sm] = start.split(":").map(Number);
                  const [eh, em] = end.split(":").map(Number);
                  const hours = (eh * 60 + em - sh * 60 - sm) / 60;
                  return hours * HOUR_HEIGHT;
                }

                return (
                  <div className="flex">
                    {/* Columna de horas */}
                    <div className="w-16 flex-shrink-0 border-r border-mcm-border">
                      <div className="h-10 border-b border-mcm-border" /> {/* header spacer */}
                      {HOURS.map(h => (
                        <div key={h} className="border-b border-mcm-border flex items-start justify-center pt-1 text-xs text-mcm-muted font-mono" style={{ height: HOUR_HEIGHT }}>
                          {h}
                        </div>
                      ))}
                    </div>
                    {/* Columnas de días */}
                    {DAYS.map(dia => (
                      <div key={dia} className="flex-1 min-w-[120px] border-r border-mcm-border last:border-r-0">
                        <div className="h-10 border-b border-mcm-border flex items-center justify-center text-xs font-medium text-mcm-muted uppercase">
                          {DAY_LABELS[dia]}
                        </div>
                        <div className="relative" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
                          {/* Líneas de hora */}
                          {HOURS.map((_, i) => (
                            <div key={i} className="absolute w-full border-b border-mcm-border/50" style={{ top: (i + 1) * HOUR_HEIGHT }} />
                          ))}
                          {/* Bloques de horario */}
                          {filteredSchedules
                            .filter(s => s.dia_semana === dia)
                            .map(s => {
                              const startTime = (s.hora_inicio ?? "").slice(0, 5);
                              const endTime = (s.hora_fin ?? "").slice(0, 5);
                              if (!startTime || !endTime) return null;
                              const top = getTop(startTime);
                              const height = getHeight(startTime, endTime);
                              return (
                                <div key={s.id}
                                  className="absolute left-1 right-1 bg-blue-50 border border-blue-200 rounded-lg p-1.5 overflow-hidden group cursor-pointer hover:bg-blue-100 transition-colors"
                                  style={{ top, height, minHeight: 30 }}
                                  onClick={() => openEditSchedule(s)}
                                >
                                  <p className="font-semibold text-blue-800 truncate text-[10px] leading-tight">{s.cursos?.nombre_curso}</p>
                                  <p className="text-blue-600 truncate text-[10px] leading-tight">{s.profiles?.nombre_completo}</p>
                                  <p className="text-blue-400 text-[9px]">{startTime}-{endTime}{s.aula ? ` · ${s.aula}` : ""}</p>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(s.id); }}
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* List view */}
          <div className="card overflow-hidden p-0">
            <div className="px-6 py-3 border-b border-mcm-border bg-slate-50 text-xs text-mcm-muted">
              {filteredSchedules.length} horarios
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>{["Profesor", "Curso", "Ciclo", "Día", "Horario", "Aula", ""].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {filteredSchedules.map(s => (
                    <tr key={s.id} className="border-t border-mcm-border hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-mcm-text">{s.profiles?.nombre_completo}</td>
                      <td className="py-3 px-4 text-mcm-text">{s.cursos?.nombre_curso}</td>
                      <td className="py-3 px-4"><span className="badge-blue">{s.cycle_number}</span></td>
                      <td className="py-3 px-4 capitalize">{s.dia_semana}</td>
                      <td className="py-3 px-4 font-mono text-xs">{s.hora_inicio} - {s.hora_fin}</td>
                      <td className="py-3 px-4 text-mcm-muted">{s.aula ?? "—"}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button onClick={() => openEditSchedule(s)} title="Editar horario"
                            className="text-mcm-muted hover:text-[#a93526]"><Pencil size={14} /></button>
                          <button onClick={() => handleDeleteSchedule(s.id)} title="Eliminar horario"
                            className="text-mcm-muted hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredSchedules.length && <tr><td colSpan={7} className="py-12 text-center text-mcm-muted text-sm">No hay horarios</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Opening modal */}
      {showOpeningModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">Aperturar Ciclo</h3>
              <button onClick={() => setShowOpeningModal(false)}><X size={20} className="text-mcm-muted" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Ciclo</label>
                <select value={openingForm.cycle_number} onChange={e => setOpeningForm({...openingForm, cycle_number: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  {[1,2,3,4,5,6].map(n => <option key={n} value={String(n)}>Ciclo {n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Fecha de inicio</label>
                <input type="date" value={openingForm.start_date} onChange={e => setOpeningForm({...openingForm, start_date: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Fecha de culminación</label>
                <input type="date" value={openingForm.fecha_fin} onChange={e => setOpeningForm({...openingForm, fecha_fin: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowOpeningModal(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleCreateOpening} disabled={saving || !openingForm.start_date}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Creando..." : "Aperturar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">Nuevo Horario</h3>
              <button onClick={() => setShowScheduleModal(false)}><X size={20} className="text-mcm-muted" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Profesor</label>
                <ProfesorCombobox
                  value={scheduleForm.profesor_id}
                  onChange={(id) => setScheduleForm({...scheduleForm, profesor_id: id})}
                  profesores={profesores}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Carrera</label>
                <select value={scheduleForm.carrera_id} onChange={e => setScheduleForm({...scheduleForm, carrera_id: e.target.value, curso_id: ""})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  <option value="">Seleccionar...</option>
                  {carreras.map(c => <option key={c.id} value={c.id}>{c.nombre_carrera}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Ciclo</label>
                <select value={scheduleForm.ciclo} onChange={e => setScheduleForm({...scheduleForm, ciclo: e.target.value, curso_id: ""})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  {[1,2,3,4,5,6].map(n => <option key={n} value={String(n)}>Ciclo {n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Curso</label>
                {(() => {
                  const cursosFiltrados = cursos.filter(c =>
                    c.ciclo_perteneciente === parseInt(scheduleForm.ciclo) &&
                    (!scheduleForm.carrera_id || c.malla_curricular?.some(m => m.carrera_id === scheduleForm.carrera_id))
                  );
                  return (
                    <select value={scheduleForm.curso_id} onChange={e => setScheduleForm({...scheduleForm, curso_id: e.target.value})}
                      className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                      <option value="">Seleccionar...</option>
                      {cursosFiltrados.length === 0
                        ? <option value="" disabled>No hay cursos disponibles para esta carrera y ciclo</option>
                        : cursosFiltrados.map(c => <option key={c.id} value={c.id}>{c.nombre_curso}</option>)
                      }
                    </select>
                  );
                })()}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Día</label>
                  <select value={scheduleForm.dia_semana} onChange={e => setScheduleForm({...scheduleForm, dia_semana: e.target.value})}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                    {DAYS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Hora inicio</label>
                  <input type="time" value={scheduleForm.hora_inicio} onChange={e => setScheduleForm({...scheduleForm, hora_inicio: e.target.value})}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Hora fin</label>
                  <input type="time" value={scheduleForm.hora_fin} onChange={e => setScheduleForm({...scheduleForm, hora_fin: e.target.value})}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Aula (opcional)</label>
                  <input value={scheduleForm.aula} onChange={e => setScheduleForm({...scheduleForm, aula: e.target.value})}
                    placeholder="Ej: A-201"
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowScheduleModal(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleCreateSchedule}
                disabled={saving || !scheduleForm.profesor_id || !scheduleForm.curso_id}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Creando..." : "Crear Horario"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar apertura */}
      {editOpeningModal.show && editOpeningModal.target && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">Editar Apertura</h3>
              <button onClick={() => setEditOpeningModal({ show: false, target: null })}><X size={20} className="text-mcm-muted" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Ciclo</label>
                <select value={editOpeningForm.cycle_number} onChange={e => setEditOpeningForm({...editOpeningForm, cycle_number: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  {[1,2,3,4,5,6].map(n => <option key={n} value={String(n)}>Ciclo {n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Fecha de inicio</label>
                <input type="date" value={editOpeningForm.start_date} onChange={e => setEditOpeningForm({...editOpeningForm, start_date: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Fecha de culminación</label>
                <input type="date" value={editOpeningForm.fecha_fin} onChange={e => setEditOpeningForm({...editOpeningForm, fecha_fin: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditOpeningModal({ show: false, target: null })} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleEditOpening} disabled={saving || !editOpeningForm.start_date}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar horario */}
      {editScheduleModal.show && editScheduleModal.target && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">Editar Horario</h3>
              <button onClick={() => setEditScheduleModal({ show: false, target: null })}><X size={20} className="text-mcm-muted" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Profesor</label>
                <ProfesorCombobox
                  value={editScheduleForm.profesor_id}
                  onChange={(id) => setEditScheduleForm({...editScheduleForm, profesor_id: id})}
                  profesores={profesores}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Ciclo</label>
                <select value={editScheduleForm.ciclo} onChange={e => setEditScheduleForm({...editScheduleForm, ciclo: e.target.value, curso_id: ""})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  {[1,2,3,4,5,6].map(n => <option key={n} value={String(n)}>Ciclo {n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Curso</label>
                {(() => {
                  const cursosFiltrados = cursos.filter(c =>
                    c.ciclo_perteneciente === parseInt(editScheduleForm.ciclo)
                  );
                  return (
                    <select value={editScheduleForm.curso_id} onChange={e => setEditScheduleForm({...editScheduleForm, curso_id: e.target.value})}
                      className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                      <option value="">Seleccionar...</option>
                      {cursosFiltrados.length === 0
                        ? <option value="" disabled>No hay cursos para este ciclo</option>
                        : cursosFiltrados.map(c => <option key={c.id} value={c.id}>{c.nombre_curso}</option>)
                      }
                    </select>
                  );
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Día</label>
                <select value={editScheduleForm.dia_semana} onChange={e => setEditScheduleForm({...editScheduleForm, dia_semana: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  {["lunes","martes","miercoles","jueves","viernes","sabado"].map(d => (
                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Hora inicio</label>
                  <input type="time" value={editScheduleForm.hora_inicio} onChange={e => setEditScheduleForm({...editScheduleForm, hora_inicio: e.target.value})}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Hora fin</label>
                  <input type="time" value={editScheduleForm.hora_fin} onChange={e => setEditScheduleForm({...editScheduleForm, hora_fin: e.target.value})}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Aula (opcional)</label>
                <input value={editScheduleForm.aula} onChange={e => setEditScheduleForm({...editScheduleForm, aula: e.target.value})}
                  placeholder="Ej: A-201"
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditScheduleModal({ show: false, target: null })} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleEditSchedule} disabled={saving || !editScheduleForm.profesor_id || !editScheduleForm.curso_id}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CiclosPage() {
  return <RouteGuard allowedRoles={["super_admin", "cycle_manager"]}><CiclosContent /></RouteGuard>;
}
