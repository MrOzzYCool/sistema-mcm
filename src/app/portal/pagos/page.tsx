"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { CreditCard, Loader2, AlertCircle, CheckCircle, Clock } from "lucide-react";
import clsx from "clsx";

interface Installment {
  id: string; tipo: string; numero: number; monto: number; monto_original: number;
  fecha_vencimiento: string; estado: string; fecha_pago: string | null; observacion: string | null;
}
interface Plan {
  id: string; ciclo: number; year: number; estado: string;
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!mountedRef.current) return;
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch("/api/portal/mis-pagos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!mountedRef.current || !res.ok) return;
      const data = await res.json();
      if (mountedRef.current) setPlans(data.plans ?? []);
    } catch { /* ignore */ }
    finally {
      fetchingRef.current = false;
      if (mountedRef.current) setFirstLoad(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    fetchPagos();
    return () => { mountedRef.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (firstLoad) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh] gap-3 text-mcm-muted">
        <Loader2 size={20} className="animate-spin" /> <span className="text-sm">Cargando pagos...</span>
      </div>
    );
  }

  const allInstallments = plans.flatMap(p => p.installments).sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
  const totalDeuda = allInstallments.filter(i => i.estado !== "pagado").reduce((s, i) => s + Number(i.monto), 0);
  const totalPagado = allInstallments.filter(i => i.estado === "pagado").reduce((s, i) => s + Number(i.monto), 0);
  const pendientes = allInstallments.filter(i => i.estado === "pendiente").length;

  return (
    <div className="p-6 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">Estado de Cuenta</h1>
        <p className="text-mcm-muted text-sm mt-0.5">Historial y estado de tus cuotas</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Deuda Pendiente" value={`S/ ${totalDeuda.toFixed(2)}`} color="red" />
        <SummaryCard label="Total Pagado" value={`S/ ${totalPagado.toFixed(2)}`} color="green" />
        <SummaryCard label="Cuotas Pendientes" value={`${pendientes} cuotas`} color="yellow" />
        <SummaryCard label="Total Cuotas" value={`${allInstallments.length} cuotas`} color="blue" />
      </div>

      {allInstallments.length === 0 ? (
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
                  {["Concepto", "Monto", "Vencimiento", "Estado", "Fecha de Pago"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allInstallments.map(inst => {
                  const isOverdue = inst.estado === "pendiente" && new Date(inst.fecha_vencimiento) < new Date();
                  return (
                    <tr key={inst.id} className="border-t border-mcm-border hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-medium text-mcm-text">
                        {inst.tipo === "matricula" ? "Matrícula" : `Cuota ${inst.numero}`}
                        {inst.observacion && <span className="text-xs text-mcm-muted ml-2">({inst.observacion})</span>}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-mcm-text">S/ {Number(inst.monto).toFixed(2)}</td>
                      <td className={clsx("py-3.5 px-4 text-xs", isOverdue ? "text-red-600 font-bold" : "text-mcm-muted")}>
                        {new Date(inst.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                        {isOverdue && <span className="ml-1 badge-red text-xs">Vencido</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        {inst.estado === "pagado" ? (
                          <span className="badge-green flex items-center gap-1 w-fit"><CheckCircle size={12} /> Pagado</span>
                        ) : isOverdue ? (
                          <span className="badge-red flex items-center gap-1 w-fit"><AlertCircle size={12} /> Vencido</span>
                        ) : (
                          <span className="badge-yellow flex items-center gap-1 w-fit"><Clock size={12} /> Pendiente</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-mcm-muted text-xs">
                        {inst.fecha_pago ? new Date(inst.fecha_pago).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: "red"|"green"|"yellow"|"blue" }) {
  const styles = {
    red: "border-l-4 border-red-400 bg-red-50", green: "border-l-4 border-green-400 bg-green-50",
    yellow: "border-l-4 border-yellow-400 bg-yellow-50", blue: "border-l-4 border-blue-400 bg-blue-50",
  };
  const textColors = { red: "text-red-700", green: "text-green-700", yellow: "text-yellow-700", blue: "text-blue-700" };
  return (
    <div className={clsx("card", styles[color])}>
      <p className="text-xs text-mcm-muted font-medium">{label}</p>
      <p className={clsx("text-2xl font-bold mt-1", textColors[color])}>{value}</p>
    </div>
  );
}
