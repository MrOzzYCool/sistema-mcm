"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import RouteGuard from "@/components/RouteGuard";
import { Loader2, RefreshCw, CheckCircle, XCircle, Eye, X, ExternalLink } from "lucide-react";

interface Voucher {
  id: string; voucher_url: string; status: string; created_at: string;
  installment_id: string; alumno_id: string;
  profiles: { nombre_completo: string };
  installments: { concepto: string; amount: number; due_date: string; plan_id: string;
    payment_plans: { ciclo: number; year: number } };
}

function VouchersContent() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<Voucher | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/voucher-review", {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (res.ok) setVouchers((await res.json()).vouchers ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleAction(voucherId: string, action: "approve" | "reject", reason?: string) {
    setSaving(voucherId);
    try {
      const res = await fetch("/api/admin/voucher-review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ voucher_id: voucherId, action, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRejectModal(null);
      setRejectReason("");
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(null); }
  }

  return (
    <div className="p-6 w-full space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Revisión de Vouchers</h1>
          <p className="text-mcm-muted text-sm">{vouchers.length} pendientes de revisión</p>
        </div>
        <button onClick={cargar} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted"><Loader2 size={20} className="animate-spin" /> Cargando...</div>
      ) : vouchers.length === 0 ? (
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
                  {["Alumno", "Concepto", "Monto", "Vencimiento", "Voucher", "Acciones"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vouchers.map(v => (
                  <tr key={v.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-mcm-text">{v.profiles?.nombre_completo}</td>
                    <td className="py-3 px-4 text-mcm-text">{v.installments?.concepto}</td>
                    <td className="py-3 px-4 font-bold">S/ {Number(v.installments?.amount ?? 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">
                      {v.installments?.due_date ? new Date(v.installments.due_date + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
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
                            <CheckCircle size={12} /> Aprobar
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
                className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526] h-20 resize-none" />
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
    </div>
  );
}

export default function VouchersPage() {
  return <RouteGuard allowedRoles={["super_admin", "administradora", "secretaria_academica"]}><VouchersContent /></RouteGuard>;
}
