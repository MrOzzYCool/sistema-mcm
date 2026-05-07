"use client";

import { useState, useEffect, useRef } from "react";
import { getAccessToken } from "@/lib/get-token";
import { supabase } from "@/lib/supabase";
import { CreditCard, Loader2, AlertCircle, CheckCircle, Clock, Paperclip, Upload } from "lucide-react";
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

export default function PagosAlumnoPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [firstLoad, setFirstLoad] = useState(true);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  async function fetchPagos() {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const token = await getAccessToken();
      if (!mountedRef.current) return;
      if (!token) return;
      const res = await fetch("/api/portal/mis-pagos", { headers: { Authorization: `Bearer ${token}` } });
      if (!mountedRef.current || !res.ok) return;
      const data = await res.json();
      if (mountedRef.current) setPlans(data.plans ?? []);
    } catch { /* ignore */ }
    finally { fetchingRef.current = false; if (mountedRef.current) setFirstLoad(false); }
  }

  useEffect(() => { mountedRef.current = true; fetchPagos(); return () => { mountedRef.current = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (firstLoad) {
    return <div className="p-6 flex items-center justify-center min-h-[50vh] gap-3 text-mcm-muted"><Loader2 size={20} className="animate-spin" /> <span className="text-sm">Cargando pagos...</span></div>;
  }

  const all = plans.flatMap(p => p.installments).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const totalDeuda = all.filter(i => i.status !== "paid").reduce((s, i) => s + Number(i.amount), 0);
  const totalPagado = all.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const pendientes = all.filter(i => i.status === "pending").length;

  return (
    <div className="p-6 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">Estado de Cuenta</h1>
        <p className="text-mcm-muted text-sm mt-0.5">Historial y estado de tus cuotas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Deuda Pendiente" value={`S/ ${totalDeuda.toFixed(2)}`} color="red" />
        <SummaryCard label="Total Pagado" value={`S/ ${totalPagado.toFixed(2)}`} color="green" />
        <SummaryCard label="Cuotas Pendientes" value={`${pendientes} cuotas`} color="yellow" />
        <SummaryCard label="Total Conceptos" value={`${all.length}`} color="blue" />
      </div>

      {all.length === 0 ? (
        <div className="card text-center py-12">
          <CreditCard size={40} className="mx-auto text-mcm-muted mb-3" />
          <h2 className="font-bold text-mcm-text text-lg mb-1">Sin cuotas registradas</h2>
          <p className="text-mcm-muted text-sm">Tu plan de pagos aún no ha sido generado.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-mcm-border flex items-center gap-2">
            <CreditCard size={16} className="text-mcm-muted" />
            <h2 className="font-semibold text-mcm-text">Detalle de cuotas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {(() => {
                    const hasDiscount = all.some(i => Number(i.amount_original) > Number(i.amount));
                    const cols = hasDiscount
                      ? ["Concepto", "Original", "Descuento", "Total", "Vencimiento", "Estado", "Acción"]
                      : ["Concepto", "Monto", "Vencimiento", "Estado", "Acción"];
                    return cols.map(h => (
                      <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                    ));
                  })()}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const hasDiscount = all.some(i => Number(i.amount_original) > Number(i.amount));
                  return all.map(inst => {
                  const isOverdue = inst.status === "pending" && new Date(inst.due_date) < new Date();
                  return (
                    <tr key={inst.id} className="border-t border-mcm-border hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-medium text-mcm-text">
                        {inst.concepto}
                        {inst.observacion && <span className="text-xs text-mcm-muted ml-2">({inst.observacion})</span>}
                      </td>
                      {hasDiscount ? (
                        <>
                          <td className="py-3.5 px-4 text-mcm-muted text-xs">S/ {Number(inst.amount_original).toFixed(2)}</td>
                          <td className="py-3.5 px-4 text-xs">
                            {Number(inst.amount_original) > Number(inst.amount) ? (
                              <span className="text-green-600 font-medium">-S/ {(Number(inst.amount_original) - Number(inst.amount)).toFixed(2)}</span>
                            ) : (
                              <span className="text-mcm-muted">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-mcm-text">S/ {Number(inst.amount).toFixed(2)}</td>
                        </>
                      ) : (
                        <td className="py-3.5 px-4 font-bold text-mcm-text">S/ {Number(inst.amount).toFixed(2)}</td>
                      )}
                      <td className={clsx("py-3.5 px-4 text-xs", isOverdue ? "text-red-600 font-bold" : "text-mcm-muted")}>
                        {new Date(inst.due_date + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                        {isOverdue && <span className="ml-1 badge-red text-xs">Vencido</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        {inst.status === "paid" ? (
                          <span className="badge-green flex items-center gap-1 w-fit"><CheckCircle size={12} /> Pagado</span>
                        ) : inst.status === "in_review" ? (
                          <span className="badge-blue flex items-center gap-1 w-fit"><Clock size={12} /> En revisión</span>
                        ) : isOverdue ? (
                          <span className="badge-red flex items-center gap-1 w-fit"><AlertCircle size={12} /> Vencido</span>
                        ) : (
                          <span className="badge-yellow flex items-center gap-1 w-fit"><Clock size={12} /> Pendiente</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {(inst.status === "pending" || isOverdue) && (
                          <VoucherUploadBtn installmentId={inst.id} onSuccess={fetchPagos} />
                        )}
                        {inst.fecha_pago && (
                          <span className="text-mcm-muted text-xs">{new Date(inst.fecha_pago).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}</span>
                        )}
                      </td>
                    </tr>
                  );
                });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: "red"|"green"|"yellow"|"blue" }) {
  const styles = { red: "border-l-4 border-red-400 bg-red-50", green: "border-l-4 border-green-400 bg-green-50", yellow: "border-l-4 border-yellow-400 bg-yellow-50", blue: "border-l-4 border-blue-400 bg-blue-50" };
  const textColors = { red: "text-red-700", green: "text-green-700", yellow: "text-yellow-700", blue: "text-blue-700" };
  return (
    <div className={clsx("card", styles[color])}>
      <p className="text-xs text-mcm-muted font-medium">{label}</p>
      <p className={clsx("text-2xl font-bold mt-1", textColors[color])}>{value}</p>
    </div>
  );
}

function VoucherUploadBtn({ installmentId, onSuccess }: { installmentId: string; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!file) return;
    setUploading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sesión no disponible");

      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `vouchers/${installmentId}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("vouchers").upload(path, file);
      if (upErr) throw new Error(upErr.message);

      const { data: urlData } = supabase.storage.from("vouchers").getPublicUrl(path);

      const res = await fetch("/api/portal/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ installment_id: installmentId, voucher_url: urlData.publicUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setFile(null);
      alert(json.message ?? "Voucher enviado correctamente");
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error subiendo voucher");
    } finally {
      setUploading(false);
    }
  }

  if (!file) {
    return (
      <>
        <button onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 text-xs font-medium text-[#a93526] hover:text-[#8a2b1f]">
          <Paperclip size={12} /> Adjuntar voucher
        </button>
        <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleSelect} />
      </>
    );
  }

  const isImage = file.type.startsWith("image/");

  return (
    <div className="space-y-2">
      {/* Preview */}
      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-mcm-border rounded-lg p-2">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={URL.createObjectURL(file)} alt="Preview" className="w-10 h-10 object-cover rounded" />
        ) : (
          <div className="w-10 h-10 bg-red-50 rounded flex items-center justify-center text-red-600 text-xs font-bold">PDF</div>
        )}
        <span className="text-xs text-mcm-text truncate flex-1">{file.name}</span>
        <button onClick={() => setFile(null)} className="text-mcm-muted hover:text-red-600 shrink-0">
          <Upload size={12} />
        </button>
      </div>
      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={uploading}
          className="flex items-center gap-1 text-xs font-semibold text-white bg-[#a93526] hover:bg-[#8a2b1f] px-3 py-1.5 rounded-lg disabled:opacity-50">
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
          {uploading ? "Enviando..." : "Enviar voucher"}
        </button>
        <button onClick={() => setFile(null)} className="text-xs text-mcm-muted hover:text-red-600">
          Quitar
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleSelect} />
    </div>
  );
}
