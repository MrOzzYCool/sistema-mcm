"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import RouteGuard from "@/components/RouteGuard";
import {
  Loader2, ArrowLeft, CreditCard, CheckCircle, Pencil, Plus,
  AlertCircle, X, Save,
} from "lucide-react";
import clsx from "clsx";

interface Installment {
  id: string; concepto: string; tipo: string; numero: number;
  amount: number; amount_original: number;
  due_date: string; status: string; fecha_pago: string | null; observacion: string | null;
}
interface Plan {
  id: string; ciclo: number; year: number; status: string;
  installments: Installment[];
}

function PagosAlumnoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const alumnoId = searchParams.get("alumno_id");
  const alumnoNombre = searchParams.get("nombre") ?? "Alumno";

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genForm, setGenForm] = useState({ ciclo: "1", year: String(new Date().getFullYear()) });
  const [showGenModal, setShowGenModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOriginal, setEditOriginal] = useState(0);
  const [editDescuento, setEditDescuento] = useState("");
  const [saving, setSaving] = useState(false);

  // Benefits state
  interface Benefit { id: string; tipo_concepto: string; monto_final: number; es_permanente: boolean; descripcion: string | null; }
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [benefitForm, setBenefitForm] = useState({ tipo: "matricula", monto: "", permanente: true, descripcion: "" });
  const [savingBenefit, setSavingBenefit] = useState(false);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadPlans() {
    if (!alumnoId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payments?alumno_id=${alumnoId}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (res.ok) setPlans((await res.json()).plans ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { loadPlans(); loadBenefits(); }, [alumnoId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadBenefits() {
    if (!alumnoId) return;
    try {
      const res = await fetch(`/api/admin/benefits?alumno_id=${alumnoId}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (res.ok) setBenefits((await res.json()).benefits ?? []);
    } catch { /* ignore */ }
  }

  async function handleSaveBenefit() {
    if (!alumnoId || !benefitForm.monto) return;
    setSavingBenefit(true); setError("");
    try {
      const res = await fetch("/api/admin/benefits", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({
          alumno_id: alumnoId,
          tipo_concepto: benefitForm.tipo,
          monto_final: parseFloat(benefitForm.monto),
          es_permanente: benefitForm.permanente,
          descripcion: benefitForm.descripcion || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSuccess("Beneficio guardado correctamente.");
      setBenefitForm({ tipo: "matricula", monto: "", permanente: true, descripcion: "" });
      loadBenefits();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setSavingBenefit(false); }
  }

  async function handleRemoveBenefit(id: string) {
    if (!confirm("¿Quitar este beneficio?")) return;
    try {
      await fetch("/api/admin/benefits", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ benefit_id: id }),
      });
      loadBenefits();
    } catch { /* ignore */ }
  }


  async function handleGenerate() {
    if (!alumnoId) return;
    setGenerating(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ action: "generate-plan", alumno_id: alumnoId, ciclo: parseInt(genForm.ciclo), year: parseInt(genForm.year) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSuccess(`Plan generado: ${json.installments} conceptos creados.`);
      setShowGenModal(false);
      loadPlans();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setGenerating(false); }
  }

  async function handleMarkPaid(id: string) {
    if (!confirm("¿Marcar esta cuota como pagada?")) return;
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ action: "mark-paid", installment_id: id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      loadPlans();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  async function handleSaveAmount() {
    if (!editingId) return;
    const descuento = parseFloat(editDescuento) || 0;
    if (descuento < 0 || descuento > editOriginal) {
      setError("El descuento no puede ser mayor al monto original ni negativo.");
      return;
    }
    const montoFinal = editOriginal - descuento;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ action: "update-amount", installment_id: editingId, monto: montoFinal, observacion: descuento > 0 ? `Descuento S/${descuento.toFixed(2)}` : null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditingId(null); loadPlans();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setSaving(false); }
  }

  function openEdit(inst: Installment) {
    setEditingId(inst.id);
    setEditOriginal(Number(inst.amount_original));
    setEditDescuento(String(Number(inst.amount_original) - Number(inst.amount)));
  }

  if (!alumnoId) {
    return <div className="p-6 card text-center py-12"><AlertCircle size={40} className="mx-auto text-red-400 mb-3" /><p className="text-mcm-text font-bold">Falta alumno_id</p><button onClick={() => router.back()} className="btn-secondary text-sm mt-4">Volver</button></div>;
  }

  return (
    <div className="p-6 w-full space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-mcm-muted hover:text-mcm-text"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-mcm-text">Pagos del Alumno</h1>
          <p className="text-mcm-muted text-sm">{alumnoNombre}</p>
        </div>
        <button onClick={() => setShowGenModal(true)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={14} /> Generar Plan</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm flex items-center gap-2"><AlertCircle size={16} />{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm flex items-center gap-2"><CheckCircle size={16} />{success}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted"><Loader2 size={20} className="animate-spin" /> Cargando...</div>
      ) : plans.length === 0 ? (
        <div className="card text-center py-12"><CreditCard size={40} className="mx-auto text-mcm-muted mb-3" /><h2 className="font-bold text-mcm-text text-lg mb-1">Sin planes de pago</h2><p className="text-mcm-muted text-sm">Genera un plan para este alumno.</p></div>
      ) : (
        plans.map(plan => (
          <div key={plan.id} className="card overflow-hidden p-0">
            <div className="px-6 py-4 border-b border-mcm-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-mcm-muted" />
                <h2 className="font-semibold text-mcm-text">Ciclo {plan.ciclo} — {plan.year}</h2>
                <span className={plan.status === "activo" ? "badge-blue" : "badge-green"}>{plan.status}</span>
              </div>
              <span className="text-xs text-mcm-muted">
                Total: S/ {plan.installments.reduce((s, i) => s + Number(i.amount), 0).toFixed(2)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Concepto", "Monto", "Original", "Vencimiento", "Estado", "Pagado", "Acciones"].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plan.installments.sort((a, b) => a.numero - b.numero).map(inst => (
                    <tr key={inst.id} className="border-t border-mcm-border hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-mcm-text">
                        {inst.concepto}
                        {inst.observacion && <span className="text-xs text-mcm-muted ml-2">({inst.observacion})</span>}
                      </td>
                      <td className="py-3 px-4 font-bold text-mcm-text">
                        S/ {Number(inst.amount).toFixed(2)}
                        {Number(inst.amount) !== Number(inst.amount_original) && <span className="text-xs text-amber-600 ml-1">(beca)</span>}
                      </td>
                      <td className="py-3 px-4 text-mcm-muted text-xs">S/ {Number(inst.amount_original).toFixed(2)}</td>
                      <td className={clsx("py-3 px-4 text-xs", inst.status === "overdue" ? "text-red-600 font-bold" : "text-mcm-muted")}>
                        {new Date(inst.due_date + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-3 px-4">
                        <span className={inst.status === "paid" ? "badge-green" : inst.status === "overdue" ? "badge-red" : "badge-yellow"}>
                          {inst.status === "paid" ? "Pagado" : inst.status === "overdue" ? "Vencido" : "Pendiente"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-mcm-muted text-xs">
                        {inst.fecha_pago ? new Date(inst.fecha_pago).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }) : "—"}
                      </td>
                      <td className="py-3 px-4">
                        {inst.status !== "paid" && (
                          <div className="flex gap-2">
                            <button onClick={() => handleMarkPaid(inst.id)} title="Marcar pagado" className="text-mcm-muted hover:text-green-600"><CheckCircle size={14} /></button>
                            <button onClick={() => openEdit(inst)} title="Editar monto" className="text-mcm-muted hover:text-blue-600"><Pencil size={14} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Beneficios Académicos */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-mcm-text">Beneficios Académicos</h2>
        </div>

        {/* Active benefits */}
        {benefits.length > 0 && (
          <div className="space-y-2 mb-4">
            {benefits.map(b => (
              <div key={b.id} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <div>
                  <span className="text-sm font-semibold text-green-800">
                    {b.tipo_concepto === "matricula" ? "Matrícula" : "Cuotas"}: S/ {Number(b.monto_final).toFixed(2)}
                  </span>
                  {b.es_permanente && <span className="badge-blue text-xs ml-2">Permanente</span>}
                  {b.descripcion && <p className="text-xs text-green-600 mt-0.5">{b.descripcion}</p>}
                </div>
                <button onClick={() => handleRemoveBenefit(b.id)}
                  className="text-red-400 hover:text-red-600 text-xs font-medium">Quitar</button>
              </div>
            ))}
          </div>
        )}

        {/* Add benefit form */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-mcm-text mb-1">Concepto</label>
            <select value={benefitForm.tipo} onChange={e => setBenefitForm({...benefitForm, tipo: e.target.value})}
              className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
              <option value="matricula">Matrícula</option>
              <option value="cuota">Cuotas</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-mcm-text mb-1">Monto a pagar (S/)</label>
            <input type="number" step="0.01" value={benefitForm.monto}
              onChange={e => setBenefitForm({...benefitForm, monto: e.target.value})}
              placeholder={benefitForm.tipo === "matricula" ? "250" : "400"}
              className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-mcm-text mb-1">Descripción</label>
            <input value={benefitForm.descripcion} onChange={e => setBenefitForm({...benefitForm, descripcion: e.target.value})}
              placeholder="Ej: Beca 50%"
              className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs cursor-pointer mt-5">
              <input type="checkbox" checked={benefitForm.permanente}
                onChange={e => setBenefitForm({...benefitForm, permanente: e.target.checked})}
                className="accent-[#a93526]" />
              Permanente
            </label>
          </div>
          <button onClick={handleSaveBenefit} disabled={savingBenefit || !benefitForm.monto}
            className="btn-primary text-sm disabled:opacity-50 flex items-center justify-center gap-2 h-[38px]">
            {savingBenefit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
        </div>
        <p className="text-xs text-mcm-muted mt-2">
          Los beneficios permanentes se aplican automáticamente al generar nuevos planes de pago.
        </p>
      </div>

      {/* Generate plan modal */}
      {showGenModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">Generar Plan de Pagos</h3>
              <button onClick={() => setShowGenModal(false)}><X size={20} className="text-mcm-muted" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Ciclo</label>
                <select value={genForm.ciclo} onChange={e => setGenForm({...genForm, ciclo: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  {[1,2,3,4,5,6].map(n => <option key={n} value={String(n)}>Ciclo {n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Año</label>
                <input type="number" value={genForm.year} onChange={e => setGenForm({...genForm, year: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                Se generará: MATRÍCULA (S/ 250) + CUOTAS 01-04 (S/ 400 c/u) = S/ 1,850 total
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowGenModal(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleGenerate} disabled={generating}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {generating && <Loader2 size={14} className="animate-spin" />}
                {generating ? "Generando..." : "Generar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit amount modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">Aplicar Descuento</h3>
              <button onClick={() => setEditingId(null)}><X size={20} className="text-mcm-muted" /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between">
                <span className="text-sm text-mcm-muted">Monto original</span>
                <span className="text-lg font-bold text-mcm-text">S/ {editOriginal.toFixed(2)}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Descuento (S/)</label>
                <input type="number" step="0.01" min="0" max={editOriginal}
                  value={editDescuento} onChange={e => setEditDescuento(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                {parseFloat(editDescuento) > editOriginal && (
                  <p className="text-red-500 text-xs mt-1">El descuento no puede ser mayor al monto original</p>
                )}
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-green-800">Total a pagar</span>
                  {parseFloat(editDescuento) > 0 && (
                    <span className="text-xs text-green-600 ml-2">
                      ({Math.round((parseFloat(editDescuento) || 0) / editOriginal * 100)}% descuento)
                    </span>
                  )}
                </div>
                <span className="text-xl font-bold text-green-800">
                  S/ {Math.max(0, editOriginal - (parseFloat(editDescuento) || 0)).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditingId(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleSaveAmount}
                disabled={saving || parseFloat(editDescuento) > editOriginal}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Guardando..." : "Aplicar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PagosAlumnoPage() {
  return <RouteGuard allowedRoles={["super_admin"]}><PagosAlumnoContent /></RouteGuard>;
}
