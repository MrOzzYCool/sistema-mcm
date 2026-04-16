"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import RouteGuard from "@/components/RouteGuard";
import { supabase } from "@/lib/supabase";
import { Plus, RefreshCw, Loader2, X, BookOpen, GraduationCap, Link2 } from "lucide-react";
import clsx from "clsx";

interface Carrera { id: string; nombre_carrera: string; codigo: string; duracion_ciclos: number; malla_curricular?: { curso_id: string; cursos: { id: string; nombre_curso: string; ciclo_perteneciente: number; creditos: number } }[] }
interface Curso { id: string; nombre_curso: string; ciclo_perteneciente: number; creditos: number; malla_curricular?: { carrera_id: string; carreras: { nombre_carrera: string } }[] }

type Tab = "carreras" | "cursos";

function AcademicoContent() {
  const [tab, setTab]             = useState<Tab>("carreras");
  const [carreras, setCarreras]   = useState<Carrera[]>([]);
  const [cursos, setCursos]       = useState<Curso[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [showModal, setShowModal] = useState<"carrera" | "curso" | null>(null);
  const [saving, setSaving]       = useState(false);

  // Forms
  const [formCarrera, setFormCarrera] = useState({ nombre_carrera: "", codigo: "", duracion_ciclos: "6" });
  const [formCurso, setFormCurso]     = useState({ nombre_curso: "", ciclo_perteneciente: "1", creditos: "3", carrera_ids: [] as string[] });

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  const cargar = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const token = await getToken();
      const [resC, resK] = await Promise.all([
        fetch("/api/admin/academico?tipo=carreras", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/academico?tipo=cursos", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (resC.ok) setCarreras(await resC.json());
      if (resK.ok) setCursos(await resK.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleCrear() {
    setSaving(true); setError("");
    const token = await getToken();
    try {
      const body = showModal === "carrera"
        ? { accion: "crear_carrera", ...formCarrera, duracion_ciclos: parseInt(formCarrera.duracion_ciclos) || 6 }
        : { accion: "crear_curso", ...formCurso, ciclo_perteneciente: parseInt(formCurso.ciclo_perteneciente) || 1, creditos: parseInt(formCurso.creditos) || 3 };

      const res = await fetch("/api/admin/academico", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setShowModal(null);
      setFormCarrera({ nombre_carrera: "", codigo: "", duracion_ciclos: "6" });
      setFormCurso({ nombre_curso: "", ciclo_perteneciente: "1", creditos: "3", carrera_ids: [] });
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6 w-full space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Gestión Académica</h1>
          <p className="text-mcm-muted text-sm">Carreras, cursos y malla curricular</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowModal(tab === "carreras" ? "carrera" : "curso")}
            className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> {tab === "carreras" ? "Nueva carrera" : "Nuevo curso"}
          </button>
          <button onClick={cargar} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-mcm-border">
        {(["carreras", "cursos"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx("px-4 py-2 text-sm font-semibold border-b-2 transition-colors capitalize",
              tab === t ? "border-[#a93526] text-[#a93526]" : "border-transparent text-mcm-muted hover:text-mcm-text")}>
            {t === "carreras" ? <><GraduationCap size={14} className="inline mr-1" />Carreras</> : <><BookOpen size={14} className="inline mr-1" />Cursos</>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted">
          <Loader2 size={20} className="animate-spin" /> <span className="text-sm">Cargando...</span>
        </div>
      ) : tab === "carreras" ? (
        /* ── Tabla Carreras ── */
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Carrera", "Código", "Ciclos", "Cursos asignados"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {carreras.map(c => (
                  <tr key={c.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-mcm-text">{c.nombre_carrera}</td>
                    <td className="py-3 px-4 font-mono text-xs text-mcm-muted">{c.codigo}</td>
                    <td className="py-3 px-4 text-mcm-text">{c.duracion_ciclos}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {c.malla_curricular?.map(m => (
                          <span key={m.curso_id} className="badge-blue text-xs">{m.cursos?.nombre_curso}</span>
                        )) ?? <span className="text-mcm-muted text-xs">Sin cursos</span>}
                      </div>
                    </td>
                  </tr>
                ))}
                {carreras.length === 0 && (
                  <tr><td colSpan={4} className="py-12 text-center text-mcm-muted text-sm">No hay carreras registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── Tabla Cursos ── */
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Curso", "Ciclo", "Créditos", "Carreras"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cursos.map(c => (
                  <tr key={c.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-mcm-text">{c.nombre_curso}</td>
                    <td className="py-3 px-4 text-mcm-text">{c.ciclo_perteneciente}</td>
                    <td className="py-3 px-4 text-mcm-text">{c.creditos}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {c.malla_curricular?.map((m, i) => (
                          <span key={i} className="badge-green text-xs">{m.carreras?.nombre_carrera}</span>
                        )) ?? <span className="text-mcm-muted text-xs">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
                {cursos.length === 0 && (
                  <tr><td colSpan={4} className="py-12 text-center text-mcm-muted text-sm">No hay cursos registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal crear */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">
                {showModal === "carrera" ? "Nueva carrera" : "Nuevo curso"}
              </h3>
              <button onClick={() => setShowModal(null)}><X size={20} className="text-mcm-muted" /></button>
            </div>

            {showModal === "carrera" ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Nombre de la carrera</label>
                  <input value={formCarrera.nombre_carrera}
                    onChange={e => setFormCarrera({ ...formCarrera, nombre_carrera: e.target.value.toUpperCase() })}
                    placeholder="ADMINISTRACIÓN DE EMPRESAS" style={{ textTransform: "uppercase" }}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Código</label>
                  <input value={formCarrera.codigo}
                    onChange={e => setFormCarrera({ ...formCarrera, codigo: e.target.value.toUpperCase() })}
                    placeholder="ADM" style={{ textTransform: "uppercase" }}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Duración (ciclos)</label>
                  <input type="number" value={formCarrera.duracion_ciclos}
                    onChange={e => setFormCarrera({ ...formCarrera, duracion_ciclos: e.target.value })}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Nombre del curso</label>
                  <input value={formCurso.nombre_curso}
                    onChange={e => setFormCurso({ ...formCurso, nombre_curso: e.target.value.toUpperCase() })}
                    placeholder="HERRAMIENTAS DIGITALES" style={{ textTransform: "uppercase" }}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-mcm-text mb-1">Ciclo</label>
                    <input type="number" min={1} max={10} value={formCurso.ciclo_perteneciente}
                      onChange={e => setFormCurso({ ...formCurso, ciclo_perteneciente: e.target.value })}
                      className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-mcm-text mb-1">Créditos</label>
                    <input type="number" min={1} max={10} value={formCurso.creditos}
                      onChange={e => setFormCurso({ ...formCurso, creditos: e.target.value })}
                      className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">
                    <Link2 size={12} className="inline mr-1" />Asignar a carreras
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {carreras.map(c => (
                      <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" className="accent-[#a93526]"
                          checked={formCurso.carrera_ids.includes(c.id)}
                          onChange={e => {
                            const ids = e.target.checked
                              ? [...formCurso.carrera_ids, c.id]
                              : formCurso.carrera_ids.filter(id => id !== c.id);
                            setFormCurso({ ...formCurso, carrera_ids: ids });
                          }} />
                        {c.nombre_carrera}
                      </label>
                    ))}
                    {carreras.length === 0 && <p className="text-xs text-mcm-muted">Crea una carrera primero</p>}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleCrear} disabled={saving}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AcademicoPage() {
  return (
    <RouteGuard allowedRoles={["super_admin"]}>
      <AcademicoContent />
    </RouteGuard>
  );
}
