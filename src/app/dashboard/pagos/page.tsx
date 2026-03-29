"use client";

import { useState } from "react";
import { MOCK_PAGOS, calcularDeuda, formatMonto, formatFecha, Pago } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";
import { EstadoBadge } from "@/components/EstadoBadge";
import RouteGuard from "@/components/RouteGuard";
import { CreditCard, Download, Plus, CheckCircle } from "lucide-react";
import clsx from "clsx";

function PagosContent() {
  const { user } = useAuth();
  const [pagos, setPagos]       = useState<Pago[]>(MOCK_PAGOS);
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const deudaTotal  = calcularDeuda(pagos);
  const totalPagado = pagos.filter((p) => p.estado === "pagado").reduce((a, p) => a + p.monto, 0);

  function marcarPagado(id: string) {
    setPagos((prev) =>
      prev.map((p) => p.id === id ? { ...p, estado: "pagado" as const, fechaPago: new Date().toISOString().split("T")[0] } : p)
    );
    setShowModal(false);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Estado de Cuenta</h1>
          <p className="text-mcm-muted text-sm mt-0.5">Historial y estado de tus cuotas</p>
        </div>
        {user?.role === "super_admin" && (
          <button className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Registrar pago
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ResumenCard label="Deuda Total"       value={formatMonto(deudaTotal)}  color="red"    />
        <ResumenCard label="Total Pagado"      value={formatMonto(totalPagado)} color="green"  />
        <ResumenCard label="Cuotas Pendientes" value={`${pagos.filter((p) => p.estado !== "pagado").length} cuotas`} color="yellow" />
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-mcm-border flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-mcm-muted" />
          <h2 className="font-semibold text-mcm-text">Detalle de cuotas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Concepto", "Vencimiento", "Monto", "Estado", "Fecha de Pago",
                  ...(user?.role === "super_admin" ? ["Acción"] : [])].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagos.map((pago) => (
                <tr key={pago.id} className="border-t border-mcm-border hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-mcm-text">{pago.concepto}</td>
                  <td className={clsx("py-3.5 px-4", pago.estado === "vencido" ? "text-red-600 font-medium" : "text-mcm-muted")}>
                    {formatFecha(pago.vencimiento)}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-mcm-text">{formatMonto(pago.monto)}</td>
                  <td className="py-3.5 px-4"><EstadoBadge estado={pago.estado} /></td>
                  <td className="py-3.5 px-4 text-mcm-muted">{pago.fechaPago ? formatFecha(pago.fechaPago) : "—"}</td>
                  {user?.role === "super_admin" && (
                    <td className="py-3.5 px-4">
                      {pago.estado !== "pagado" && (
                        <button onClick={() => { setSelectedId(pago.id); setShowModal(true); }}
                          className="flex items-center gap-1.5 text-xs text-mcm-primary hover:text-mcm-dark font-medium">
                          <CheckCircle size={14} /> Marcar pagado
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-secondary flex items-center gap-2 text-sm">
          <Download size={15} /> Exportar estado de cuenta
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-mcm-text text-lg mb-2">Confirmar pago</h3>
            <p className="text-mcm-muted text-sm mb-5">¿Confirmas que esta cuota ha sido pagada?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={() => selectedId && marcarPagado(selectedId)} className="btn-primary flex-1 text-sm">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResumenCard({ label, value, color }: { label: string; value: string; color: "red"|"green"|"yellow" }) {
  const colors = { red: "border-l-4 border-red-400 bg-red-50", green: "border-l-4 border-green-400 bg-green-50", yellow: "border-l-4 border-yellow-400 bg-yellow-50" };
  const textColors = { red: "text-red-700", green: "text-green-700", yellow: "text-yellow-700" };
  return (
    <div className={clsx("card", colors[color])}>
      <p className="text-xs text-mcm-muted font-medium">{label}</p>
      <p className={clsx("text-2xl font-bold mt-1", textColors[color])}>{value}</p>
    </div>
  );
}

export default function PagosPage() {
  return <RouteGuard allowedRoles={["super_admin", "alumno"]}><PagosContent /></RouteGuard>;
}
