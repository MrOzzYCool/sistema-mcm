"use client";

import { useState, useEffect, useCallback } from "react";
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
  id: string; profesor_id: string; curso_id: string; ciclo: number;
  dia_semana: string; hora_inicio: string; hora_fin: string; aula: string | null;
  profiles: { nombre_completo: string };
  cursos: { nombre_curso: string };
}
interface Profesor { id: string; nombre_completo: string; }
interface Curso { id: string; nombre_curso: string; ciclo_perteneciente: number; }

function CiclosContent() {
  const { user } = useAuth();
  const canDelete = user?.role && ["super_admin"].includes(user.role);

  const [tab, setTab] = useState<"aperturas" | "horarios">("aperturas");
  const [openings, setOpenings] = useState<CycleOpening[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modals
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editOpeningModal, setEditOpeningModal] = useState<{ show: boolean; target: CycleOpening | null }>({ show: false, target: null });
  const [editOpeningForm, setEditOpeningForm] = useState({ cycle_number: "1", start_date: "", fecha_fin: "" });
  const [saving, setSaving] = useState(false);

  // Forms
  const [openingForm, setOpeningForm] = useState({ cycle_number: "1", start_date: "", fecha_fin: "" });
  const [scheduleForm, setScheduleForm] = useState({
    profesor_id: "", curso_id: "", ciclo: "1",
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

      const [resO, resS, resP, resC] = await Promise.all([
        fetch("/api/admin/cycle-openings", { headers }),
        fetch("/api/admin/schedules", { headers }),
        fetch("/api/admin/users", { headers }),
        fetch("/api/admin/academico?tipo=cursos", { headers }),
      ]);

      if (resO.ok) setOpenings((await resO.json()).openings ?? []);
      if (resS.ok) setSchedules((await resS.json()).schedules ?? []);
      if (resP.ok) {
        const users = await resP.json();
        setProfesores(users.filter((u: { rol: string }) => u.rol === "profesor"));
      }
      if (resC.ok) setCursos(await resC.json());
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
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/admin/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify(scheduleForm),
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
    : schedules.filter(s => s.ciclo === parseInt(filterCiclo));

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
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="py-3 px-3 text-mcm-muted font-medium uppercase tracking-wide w-20">Hora</th>
                    {DAYS.map(d => (
                      <th key={d} className="py-3 px-3 text-mcm-muted font-medium uppercase tracking-wide text-center">{DAY_LABELS[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {["18:00", "19:00", "20:00", "21:00"].map(hora => (
                    <tr key={hora} className="border-t border-mcm-border">
                      <td className="py-4 px-3 font-mono text-mcm-muted">{hora}</td>
                      {DAYS.map(dia => {
                        const matches = filteredSchedules.filter(s =>
                          s.dia_semana === dia && s.hora_inicio <= hora && s.hora_fin > hora
                        );
                        return (
                          <td key={dia} className="py-2 px-1 text-center align-top">
                            {matches.map(s => (
                              <div key={s.id} className="bg-blue-50 border border-blue-200 rounded-lg p-1.5 mb-1 text-left group relative">
                                <p className="font-semibold text-blue-800 truncate">{s.cursos?.nombre_curso}</p>
                                <p className="text-blue-600 truncate">{s.profiles?.nombre_completo}</p>
                                <p className="text-blue-400">{s.hora_inicio}-{s.hora_fin} {s.aula && `· ${s.aula}`}</p>
                                <button onClick={() => handleDeleteSchedule(s.id)}
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
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
                      <td className="py-3 px-4"><span className="badge-blue">{s.ciclo}</span></td>
                      <td className="py-3 px-4 capitalize">{s.dia_semana}</td>
                      <td className="py-3 px-4 font-mono text-xs">{s.hora_inicio} - {s.hora_fin}</td>
                      <td className="py-3 px-4 text-mcm-muted">{s.aula ?? "—"}</td>
                      <td className="py-3 px-4">
                        <button onClick={() => handleDeleteSchedule(s.id)} className="text-mcm-muted hover:text-red-600"><Trash2 size={14} /></button>
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
                <select value={scheduleForm.profesor_id} onChange={e => setScheduleForm({...scheduleForm, profesor_id: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  <option value="">Seleccionar...</option>
                  {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre_completo}</option>)}
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
                <select value={scheduleForm.curso_id} onChange={e => setScheduleForm({...scheduleForm, curso_id: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  <option value="">Seleccionar...</option>
                  {cursos.filter(c => c.ciclo_perteneciente === parseInt(scheduleForm.ciclo)).length === 0
                    ? <option value="" disabled>No hay cursos disponibles para este ciclo</option>
                    : cursos.filter(c => c.ciclo_perteneciente === parseInt(scheduleForm.ciclo)).map(c => (
                        <option key={c.id} value={c.id}>{c.nombre_curso}</option>
                      ))
                  }
                </select>
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
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Aula (opcional)</label>
                <input value={scheduleForm.aula} onChange={e => setScheduleForm({...scheduleForm, aula: e.target.value})}
                  placeholder="Ej: A-201"
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
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
    </div>
  );
}

export default function CiclosPage() {
  return <RouteGuard allowedRoles={["super_admin", "cycle_manager"]}><CiclosContent /></RouteGuard>;
}
