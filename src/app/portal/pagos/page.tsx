"use client";

import { MOCK_PAGOS, calcularDeuda, formatMonto, formatFecha } from "@/lib/mock-data";
import { EstadoBadge } from "@/components/EstadoBadge";
import { CreditCard, Download } from "lucide-react";
import clsx from "clsx";

export default function PagosAlumnoPage() {
  const deudaTotal  = calcularDeuda(MOCK_PAGOS);
  const totalPagado = MOCK_PAGOS.filter((p) => p.estado === "pagado").reduce((a, p) => a + p.monto, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">Estado de Cuenta</h1>
        <p className="text-mcm-muted text-sm mt-0.5">Historial y estado de tus cuotas</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ResumenCard label="Deuda Total"       value={formatMonto(deudaTotal)}  color="red"    />
        <ResumenCard label="Total Pagado"      value={formatMonto(totalPagado)} color="green"  />
        <ResumenCard label="Cuotas Pendientes" value={`${MOCK_PAGOS.filter((p) => p.estado !== "pagado").length} cuotas`} color="yellow" />
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-mcm-border flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-mcm-muted" />
          <h2 className="font-semibold text-mcm-text">Detalle de cuotas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Concepto", "Vencimiento", "Monto", "Estado", "Fecha de Pago"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_PAGOS.map((pago) => (
                <tr key={pago.id} className="border-t border-mcm-border hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-mcm-text">{pago.concepto}</td>
                  <td className={clsx("py-3.5 px-4", pago.estado === "vencido" ? "text-red-600 font-medium" : "text-mcm-muted")}>
                    {formatFecha(pago.vencimiento)}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-mcm-text">{formatMonto(pago.monto)}</td>
                  <td className="py-3.5 px-4"><EstadoBadge estado={pago.estado} /></td>
                  <td className="py-3.5 px-4 text-mcm-muted">{pago.fechaPago ? formatFecha(pago.fechaPago) : "—"}</td>
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
