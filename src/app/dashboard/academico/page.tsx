"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import RouteGuard from "@/components/RouteGuard";
import { supabase } from "@/lib/supabase";
import { Plus, RefreshCw, Loader2, X, BookOpen, GraduationCap, Link2, Pencil, Upload, Download } from "lucide-react";
import clsx from "clsx";

interface Carrera { id: string; nombre_carrera: string; codigo: string; duracion_ciclos: number; malla_curricular?: { curso_id: string; cursos: { id: string; nombre_curso: string; ciclo_perteneciente: number; creditos: number } }[] }
interface Curso { id: string; nombre_curso: string; ciclo_perteneciente: number; creditos: number; malla_curricular?: { carrera_id: string; carreras: { nombre_carrera: string; codigo: string } }[] }

type Tab = "carreras" | "cursos";
type ModalType = "carrera" | "curso" | "editCurso" | "importCSV" | null;

function AcademicoContent() {
  const [tab, setTab]             = useState<Tab>("carreras");
  const [carreras, setCarreras]   = useState<Carrera[]>([]);
  const [cursos, setCursos]       = useState<Curso[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [modal, setModal]         = useState<ModalType>(null);
  const [saving, setSaving]       = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

  const [formCarrera, setFormCarrera] = useState({ nombre_carrera: "", codigo: "", duracion_ciclos: "6" });
  const [formCurso, setFormCurso]     = useState({ id: "", nombre_curso: "", ciclo_perteneciente: "1", creditos: "3", carrera_ids: [] as string[] });
  const [csvRows, setCsvRows]         = useState<{ nombre_curso: string; ciclo: number; creditos: number; career_codes: string[] }[]>([]);
  const [importResult, setImportResult] = useState<{ nombre: string; status: string; message?: string }[] | null>(null);

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

  async function apiCall(method: string, body: Record<string, unknown>) {
    const token = await getToken();
    const res = await fetch("/api/admin/academico", {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json;
  }

  async function handleCrearCarrera() {
    setSaving(true); setError("");
    try {
      await apiCall("POST", { accion: "crear_carrera", ...formCarrera, duracion_ciclos: parseInt(formCarrera.duracion_ciclos) || 6 });
      setModal(null); setFormCarrera({ nombre_carrera: "", codigo: "", duracion_ciclos: "6" }); cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  async function handleCrearCurso() {
    if (!formCurso.carrera_ids.length) { setError("Debes seleccionar al menos 1 carrera"); return; }
    setSaving(true); setError("");
    try {
      await apiCall("POST", {
        accion: "crear_curso", nombre_curso: formCurso.nombre_curso,
        ciclo_perteneciente: parseInt(formCurso.ciclo_perteneciente) || 1,
        creditos: parseInt(formCurso.creditos) || 3, carrera_ids: formCurso.carrera_ids,
      });
      setModal(null); resetFormCurso(); cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  async function handleEditCurso() {
    setSaving(true); setError("");
    try {
      await apiCall("PUT", {
        tipo: "curso", id: formCurso.id, nombre_curso: formCurso.nombre_curso,
        ciclo_perteneciente: parseInt(formCurso.ciclo_perteneciente) || 1,
        creditos: parseInt(formCurso.creditos) || 3, carrera_ids: formCurso.carrera_ids,
      });
      setModal(null); resetFormCurso(); cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  function resetFormCurso() {
    setFormCurso({ id: "", nombre_curso: "", ciclo_perteneciente: "1", creditos: "3", carrera_ids: [] });
  }

  function openEdit(c: Curso) {
    setFormCurso({
      id: c.id, nombre_curso: c.nombre_curso,
      ciclo_perteneciente: String(c.ciclo_perteneciente), creditos: String(c.creditos),
      carrera_ids: c.malla_curricular?.map(m => m.carrera_id) ?? [],
    });
    setModal("editCurso");
  }

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split("\n").filter(Boolean);
      const rows = lines.slice(1).map(line => {
        const [nombre_curso, , cicloStr, creditosStr, codesStr] = line.split(",").map(s => s.trim());
        return {
          nombre_curso: nombre_curso ?? "", ciclo: parseInt(cicloStr) || 1,
          creditos: parseInt(creditosStr) || 3,
          career_codes: (codesStr ?? "").split(";").map(s => s.trim()).filter(Boolean),
        };
      }).filter(r => r.nombre_curso);
      setCsvRows(rows); setModal("importCSV"); setImportResult(null);
    };
    reader.readAsText(file);
    if (csvRef.current) csvRef.current.value = "";
  }

  async function executeImport() {
    setSaving(true); setError("");
    try {
      const json = await apiCall("POST", { accion: "import_cursos", rows: csvRows });
      setImportResult(json.results); cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  function downloadTemplate() {
    const csv = "nombre_curso,codigo_interno,ciclo,creditos,career_codes\nHERRAMIENTAS DIGITALES,HD01,1,3,ADM;CONT\nCONTABILIDAD BÁSICA,CB01,1,4,CONT";
    const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "plantilla_cursos.csv"; a.click();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 w-full space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Gestión Académica</h1>
          <p className="text-mcm-muted text-sm">{carreras.length} carreras · {cursos.length} cursos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { resetFormCurso(); setModal(tab === "carreras" ? "carrera" : "curso"); }}
            className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> {tab === "carreras" ? "Nueva carrera" : "Nuevo curso"}
          </button>
          {tab === "cursos" && <>
            <button onClick={() => csvRef.current?.click()} className="btn-secondary flex items-center gap-2 text-sm">
              <Upload size={14} /> Importar CSV
            </button>
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFile} />
            <button onClick={downloadTemplate} className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={14} /> Plantilla
            </button>
          </>}
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
            className={clsx("px-4 py-2 text-sm font-semibold border-b-2 transition-colors",
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
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>{["Carrera", "Código", "Ciclos", "Cursos"].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {carreras.map(c => (
                  <tr key={c.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-mcm-text">{c.nombre_carrera}</td>
                    <td className="py-3 px-4 font-mono text-xs text-mcm-muted">{c.codigo}</td>
                    <td className="py-3 px-4">{c.duracion_ciclos}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {c.malla_curricular?.map(m => (
                          <span key={m.curso_id} className="badge-blue text-xs">{m.cursos?.nombre_curso}</span>
                        )) ?? <span className="text-mcm-muted text-xs">Sin cursos</span>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!carreras.length && <tr><td colSpan={4} className="py-12 text-center text-mcm-muted text-sm">No hay carreras</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>{["Curso", "Ciclo", "Créditos", "Carreras", ""].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {cursos.map(c => (
                  <tr key={c.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-mcm-text">{c.nombre_curso}</td>
                    <td className="py-3 px-4">{c.ciclo_perteneciente}</td>
                    <td className="py-3 px-4">{c.creditos}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {c.malla_curricular?.map((m, i) => (
                          <span key={i} className="badge-green text-xs">{m.carreras?.nombre_carrera}</span>
                        )) ?? <span className="text-mcm-muted text-xs">—</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <button onClick={() => openEdit(c)} className="text-mcm-muted hover:text-[#a93526]"><Pencil size={14} /></button>
                    </td>
                  </tr>
                ))}
                {!cursos.length && <tr><td colSpan={5} className="py-12 text-center text-mcm-muted text-sm">No hay cursos</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {(modal === "carrera") && (
        <Modal title="Nueva carrera" onClose={() => setModal(null)} onSave={handleCrearCarrera} saving={saving}>
          <Input label="Nombre" value={formCarrera.nombre_carrera} onChange={v => setFormCarrera({...formCarrera, nombre_carrera: v.toUpperCase()})} upper />
          <Input label="Código" value={formCarrera.codigo} onChange={v => setFormCarrera({...formCarrera, codigo: v.toUpperCase()})} upper />
          <Input label="Ciclos" value={formCarrera.duracion_ciclos} onChange={v => setFormCarrera({...formCarrera, duracion_ciclos: v})} type="number" />
        </Modal>
      )}

      {(modal === "curso" || modal === "editCurso") && (
        <Modal title={modal === "editCurso" ? "Editar curso" : "Nuevo curso"} onClose={() => setModal(null)}
          onSave={modal === "editCurso" ? handleEditCurso : handleCrearCurso} saving={saving}
          saveLabel={modal === "editCurso" ? "Guardar" : "Crear"}>
          <Input label="Nombre del curso" value={formCurso.nombre_curso} onChange={v => setFormCurso({...formCurso, nombre_curso: v.toUpperCase()})} upper />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ciclo" value={formCurso.ciclo_perteneciente} onChange={v => setFormCurso({...formCurso, ciclo_perteneciente: v})} type="number" />
            <Input label="Créditos" value={formCurso.creditos} onChange={v => setFormCurso({...formCurso, creditos: v})} type="number" />
          </div>
          <div>
            <label className="block text-sm font-medium text-mcm-text mb-1"><Link2 size={12} className="inline mr-1" />Carreras *</label>
            <div className="space-y-1 max-h-40 overflow-y-auto border border-mcm-border rounded-lg p-2">
              {carreras.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer px-1 py-0.5 hover:bg-slate-50 rounded">
                  <input type="checkbox" className="accent-[#a93526]"
                    checked={formCurso.carrera_ids.includes(c.id)}
                    onChange={e => {
                      const ids = e.target.checked ? [...formCurso.carrera_ids, c.id] : formCurso.carrera_ids.filter(id => id !== c.id);
                      setFormCurso({...formCurso, carrera_ids: ids});
                    }} />
                  {c.nombre_carrera} <span className="text-mcm-muted text-xs">({c.codigo})</span>
                </label>
              ))}
              {!carreras.length && <p className="text-xs text-mcm-muted p-1">Crea una carrera primero</p>}
            </div>
            {!formCurso.carrera_ids.length && <p className="text-red-500 text-xs mt-1">Selecciona al menos 1 carrera</p>}
          </div>
        </Modal>
      )}

      {modal === "importCSV" && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">Importar cursos desde CSV</h3>
              <button onClick={() => { setModal(null); setCsvRows([]); setImportResult(null); }}><X size={20} className="text-mcm-muted" /></button>
            </div>

            {!importResult ? (
              <>
                <p className="text-sm text-mcm-muted mb-3">Vista previa ({csvRows.length} filas):</p>
                <div className="overflow-x-auto border border-mcm-border rounded-lg mb-4">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>{["Curso", "Ciclo", "Créd.", "Carreras"].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-mcm-muted font-medium">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 10).map((r, i) => (
                        <tr key={i} className="border-t border-mcm-border">
                          <td className="py-1.5 px-3">{r.nombre_curso}</td>
                          <td className="py-1.5 px-3">{r.ciclo}</td>
                          <td className="py-1.5 px-3">{r.creditos}</td>
                          <td className="py-1.5 px-3">{r.career_codes.join("; ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvRows.length > 10 && <p className="text-xs text-mcm-muted mb-3">...y {csvRows.length - 10} más</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setModal(null); setCsvRows([]); }} className="btn-secondary flex-1 text-sm">Cancelar</button>
                  <button onClick={executeImport} disabled={saving} className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    {saving ? "Importando..." : `Importar ${csvRows.length} cursos`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-mcm-text mb-3 font-medium">
                  Resultado: {importResult.filter(r => r.status === "ok").length} exitosos, {importResult.filter(r => r.status === "error").length} errores
                </p>
                <div className="space-y-1 max-h-60 overflow-y-auto mb-4">
                  {importResult.map((r, i) => (
                    <div key={i} className={`text-xs p-2 rounded ${r.status === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {r.nombre} — {r.status === "ok" ? "✓" : r.message}
                    </div>
                  ))}
                </div>
                <button onClick={() => { setModal(null); setCsvRows([]); setImportResult(null); }} className="btn-primary w-full text-sm">Cerrar</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function Modal({ title, onClose, onSave, saving, saveLabel, children }: {
  title: string; onClose: () => void; onSave: () => void; saving: boolean; saveLabel?: string; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-mcm-text text-lg">{title}</h3>
          <button onClick={onClose}><X size={20} className="text-mcm-muted" /></button>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancelar</button>
          <button onClick={onSave} disabled={saving}
            className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Guardando..." : (saveLabel ?? "Crear")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type, upper }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; upper?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-mcm-text mb-1">{label}</label>
      <input type={type ?? "text"} value={value} onChange={e => onChange(e.target.value)}
        style={upper ? { textTransform: "uppercase" } : undefined}
        className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
    </div>
  );
}

export default function AcademicoPage() {
  return <RouteGuard allowedRoles={["super_admin"]}><AcademicoContent /></RouteGuard>;
}
