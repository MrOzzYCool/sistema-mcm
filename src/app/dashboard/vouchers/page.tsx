"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import RouteGuard from "@/components/RouteGuard";
import { Loader2, RefreshCw, CheckCircle, XCircle, Eye, X, ExternalLink, Paperclip, Save } from "lucide-react";

interface Voucher {
  id: string; voucher_url: string; status: string; created_at: string; reviewed_at?: string;
  installment_id: string; alumno_id: string;
  profiles: { nombre_completo: string };
  installments: { concepto: string; amount: number; amount_original?: number; due_date: string; plan_id: string;
    payment_plans: { ciclo: number; year: number } };
}

function VouchersContent() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [historial, setHistorial] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<Voucher | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [tab, setTab] = useState<"pendientes" | "historial">("pendientes");

  // Manual comprobante modal
  const [manualModal, setManualModal] = useState<{ show: boolean; voucher: Voucher | null }>({ show: false, voucher: null });
  const [manualForm, setManualForm] = useState({ serie: "BBB2", numero: "", tipo: "boleta", url: "" });
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualSaving, setManualSaving] = useState(false);
  const manualFileRef = useRef<HTMLInputElement>(null);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const [resPending, resHistory] = await Promise.all([
        fetch("/api/admin/voucher-review?status=pending_review", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/voucher-review?status=all", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (resPending.ok) setVouchers((await resPending.json()).vouchers ?? []);
      if (resHistory.ok) {
        const all = (await resHistory.json()).vouchers ?? [];
        setHistorial(all.filter((v: Voucher) => v.status !== "pending_review"));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleAction(voucherId: string, action: "approve" | "reject", reason?: string, tipoComprobante?: string, ruc?: string) {
    setSaving(voucherId);
    try {
      const res = await fetch("/api/admin/voucher-review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ voucher_id: voucherId, action, reason, tipo_comprobante: tipoComprobante, ruc }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRejectModal(null);
      setRejectReason("");
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(null); }
  }

  async function handleRestore(voucherId: string) {
    if (!confirm("¿Deseas restablecer este voucher a estado Pendiente?\nSe limpiará cualquier comprobante generado.")) return;
    setSaving(voucherId);
    try {
      const res = await fetch("/api/admin/voucher-review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ voucher_id: voucherId, action: "restore" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(null); }
  }

  function openManualComprobante(v: Voucher) {
    setManualModal({ show: true, voucher: v });
    setManualForm({ serie: "BBB2", numero: "", tipo: "boleta", url: "" });
    setManualFile(null);
  }

  async function handleManualComprobante() {
    if (!manualModal.voucher || !manualForm.serie || !manualForm.numero) return;
    setManualSaving(true); setError("");
    try {
      let comprobanteUrl = manualForm.url;

      // If file was uploaded, store it in Supabase Storage
      if (manualFile) {
        const ext = manualFile.name.split(".").pop() ?? "pdf";
        const path = `comprobantes/${manualModal.voucher.installment_id}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("vouchers").upload(path, manualFile);
        if (upErr) throw new Error(upErr.message);
        const { data: urlData } = supabase.storage.from("vouchers").getPublicUrl(path);
        comprobanteUrl = urlData.publicUrl;
      }

      if (!comprobanteUrl) throw new Error("Debes subir un archivo o ingresar una URL");

      const res = await fetch("/api/admin/voucher-review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({
          voucher_id: manualModal.voucher.id,
          action: "manual-attach",
          comprobante_url: comprobanteUrl,
          comprobante_serie: manualForm.serie,
          comprobante_numero: manualForm.numero,
          tipo_comprobante: manualForm.tipo,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setManualModal({ show: false, voucher: null });
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setManualSaving(false); }
  }

  return (
    <div className="p-6 w-full space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Revisión de Vouchers</h1>
          <p className="text-mcm-muted text-sm">{vouchers.length} pendientes · {historial.length} procesados</p>
        </div>
        <button onClick={cargar} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-mcm-border">
        <button onClick={() => setTab("pendientes")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === "pendientes" ? "border-[#C62828] text-[#C62828]" : "border-transparent text-mcm-muted hover:text-mcm-text"
          }`}>
          Pendientes ({vouchers.length})
        </button>
        <button onClick={() => setTab("historial")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === "historial" ? "border-[#C62828] text-[#C62828]" : "border-transparent text-mcm-muted hover:text-mcm-text"
          }`}>
          Historial ({historial.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted"><Loader2 size={20} className="animate-spin" /> Cargando...</div>
      ) : tab === "pendientes" ? (
        vouchers.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle size={40} className="mx-auto text-green-400 mb-3" />
          <h2 className="font-bold text-mcm-text text-lg mb-1">Sin vouchers pendientes</h2>
          <p className="text-mcm-muted text-sm">Todos los vouchers han sido procesados.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Alumno", "Ciclo", "Concepto", "Monto", "Comprobante", "Voucher", "Acciones"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vouchers.map(v => (
                  <tr key={v.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-mcm-text">{v.profiles?.nombre_completo}</td>
                    <td className="py-3 px-4"><span className="badge-blue text-xs">Ciclo {(v.installments as unknown as { payment_plans: { ciclo: number } })?.payment_plans?.ciclo ?? "—"}</span></td>
                    <td className="py-3 px-4 text-mcm-text">{v.installments?.concepto}</td>
                    <td className="py-3 px-4 font-bold">
                      {Number(v.installments?.amount_original ?? 0) > Number(v.installments?.amount ?? 0) && Number(v.installments?.amount ?? 0) > 0 ? (
                        <div>
                          <span className="text-xs text-mcm-muted line-through">S/ {Number(v.installments?.amount_original ?? 0).toFixed(2)}</span>
                          <span className="block text-green-700 font-bold">S/ {Number(v.installments?.amount ?? 0).toFixed(2)}</span>
                        </div>
                      ) : (
                        <span>S/ {Number(v.installments?.amount ?? 0).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs">
                        {(v as unknown as { tipo_comprobante?: string; ruc_factura?: string }).tipo_comprobante === "factura"
                          ? <span className="badge-blue">🏢 Factura: {(v as unknown as { ruc_factura?: string }).ruc_factura}</span>
                          : <span className="badge-green">🧾 Boleta</span>}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button onClick={() => setPreview(v.voucher_url)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                        <Eye size={12} /> Ver
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      {saving === v.id ? (
                        <Loader2 size={14} className="animate-spin text-mcm-muted" />
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => handleAction(v.id, "approve")}
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium">
                            <CheckCircle size={12} /> Aprobar y Emitir
                          </button>
                          <button onClick={() => { setRejectModal(v); setRejectReason(""); }}
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium">
                            <XCircle size={12} /> Rechazar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )) : (
        /* Historial tab */
        historial.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-mcm-muted text-sm">No hay vouchers procesados aún.</p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Alumno", "Ciclo", "Concepto", "Monto", "Estado", "Comprobante", "Acciones"].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historial.map(v => (
                    <tr key={v.id} className="border-t border-mcm-border hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-mcm-text">{v.profiles?.nombre_completo}</td>
                      <td className="py-3 px-4"><span className="badge-blue text-xs">Ciclo {(v.installments as unknown as { payment_plans: { ciclo: number } })?.payment_plans?.ciclo ?? "—"}</span></td>
                      <td className="py-3 px-4 text-mcm-text">{v.installments?.concepto}</td>
                      <td className="py-3 px-4 font-bold">
                        {Number(v.installments?.amount_original ?? 0) > Number(v.installments?.amount ?? 0) && Number(v.installments?.amount ?? 0) > 0 ? (
                          <div>
                            <span className="text-xs text-mcm-muted line-through">S/ {Number(v.installments?.amount_original ?? 0).toFixed(2)}</span>
                            <span className="block text-green-700 font-bold">S/ {Number(v.installments?.amount ?? 0).toFixed(2)}</span>
                          </div>
                        ) : (
                          <span>S/ {Number(v.installments?.amount ?? 0).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={v.status === "approved" ? "badge-green" : "badge-red"}>
                          {v.status === "approved" ? "Aprobado" : "Rechazado"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {(v.installments as unknown as { comprobante_url?: string })?.comprobante_url ? (
                          <a href={(v.installments as unknown as { comprobante_url: string }).comprobante_url}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium">
                            <ExternalLink size={12} /> Ver comprobante
                          </a>
                        ) : (
                          <span className="text-xs text-mcm-muted">Sin comprobante</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button onClick={() => setPreview(v.voucher_url)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                            <Eye size={12} /> Voucher
                          </button>
                          {!(v.installments as unknown as { comprobante_url?: string })?.comprobante_url && (
                            <button onClick={() => openManualComprobante(v)}
                              className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium"
                              title="Adjuntar comprobante manual">
                              <Paperclip size={12} /> Adjuntar
                            </button>
                          )}
                          <button onClick={() => handleRestore(v.id)}
                            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium">
                            Restablecer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-4 max-w-lg w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-mcm-text">Voucher</h3>
              <div className="flex gap-2">
                <a href={preview} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800"><ExternalLink size={16} /></a>
                <button onClick={() => setPreview(null)}><X size={20} className="text-mcm-muted" /></button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Voucher" className="w-full rounded-lg" />
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-mcm-text text-lg mb-3">Rechazar voucher</h3>
            <p className="text-mcm-muted text-sm mb-3">Alumno: {rejectModal.profiles?.nombre_completo}</p>
            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1">Motivo del rechazo</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Ej: Voucher ilegible, monto no coincide..."
                className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] h-20 resize-none" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={() => handleAction(rejectModal.id, "reject", rejectReason)}
                disabled={saving === rejectModal.id}
                className="flex-1 text-sm text-white font-semibold px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50">
                {saving === rejectModal.id ? "Rechazando..." : "Rechazar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual comprobante modal */}
      {manualModal.show && manualModal.voucher && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">Adjuntar Comprobante Manual</h3>
              <button onClick={() => setManualModal({ show: false, voucher: null })}><X size={20} className="text-mcm-muted" /></button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-800">
              <p><strong>{manualModal.voucher.profiles?.nombre_completo}</strong></p>
              <p>Concepto: <strong>{manualModal.voucher.installments?.concepto}</strong></p>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Serie</label>
                  <input value={manualForm.serie} onChange={e => setManualForm({...manualForm, serie: e.target.value.toUpperCase()})}
                    placeholder="BBB2" className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Número</label>
                  <input value={manualForm.numero} onChange={e => setManualForm({...manualForm, numero: e.target.value.replace(/\D/g,"")})}
                    placeholder="4557" className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Tipo</label>
                <select value={manualForm.tipo} onChange={e => setManualForm({...manualForm, tipo: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828]">
                  <option value="boleta">Boleta</option>
                  <option value="factura">Factura</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Archivo PDF/Imagen del comprobante</label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => manualFileRef.current?.click()}
                    className="btn-secondary text-xs flex items-center gap-1">
                    <Paperclip size={12} /> {manualFile ? manualFile.name : "Seleccionar archivo"}
                  </button>
                  {manualFile && <button onClick={() => setManualFile(null)} className="text-red-500 text-xs">Quitar</button>}
                </div>
                <input ref={manualFileRef} type="file" accept="image/*,.pdf" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) setManualFile(e.target.files[0]); }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">O pegar URL directa del PDF</label>
                <input value={manualForm.url} onChange={e => setManualForm({...manualForm, url: e.target.value})}
                  placeholder="https://..." className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828]" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setManualModal({ show: false, voucher: null })} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleManualComprobante}
                disabled={manualSaving || !manualForm.serie || !manualForm.numero || (!manualFile && !manualForm.url)}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {manualSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {manualSaving ? "Guardando..." : "Adjuntar comprobante"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function VouchersPage() {
  return <RouteGuard allowedRoles={["super_admin", "administradora", "secretaria_academica"]}><VouchersContent /></RouteGuard>;
}
