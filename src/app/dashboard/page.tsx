"use client";

import { useAuth } from "@/lib/auth-context";
import {
  MOCK_PAGOS, MOCK_TRAMITES, MOCK_AVISOS,
  calcularDeuda, formatMonto, formatFecha,
} from "@/lib/mock-data";
import {
  CreditCard, FileText, AlertTriangle, CheckCircle,
  Clock, TrendingUp, Bell, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { EstadoBadge } from "@/components/EstadoBadge";

const AVISO_STYLES = {
  danger:  { bg: "bg-red-50 border-red-200",    icon: "text-red-500",    dot: "bg-red-500"    },
  warning: { bg: "bg-yellow-50 border-yellow-200", icon: "text-yellow-500", dot: "bg-yellow-500" },
  info:    { bg: "bg-blue-50 border-blue-200",   icon: "text-blue-500",   dot: "bg-blue-500"   },
};

export default function DashboardPage() {
  const { user } = useAuth();

  const deudaTotal    = calcularDeuda(MOCK_PAGOS);
  const pagosVencidos = MOCK_PAGOS.filter((p) => p.estado === "vencido").length;
  const tramitesPend  = MOCK_TRAMITES.filter((t) => t.estado === "pendiente" || t.estado === "en_proceso").length;
  const tramitesOk    = MOCK_TRAMITES.filter((t) => t.estado === "aprobado").length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">
          Bienvenido, {user?.name.split(" ")[0]} 👋
        </h1>
        <p className="text-mcm-muted text-sm mt-0.5">
          {user?.email}
        </p>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Deuda Total"
          value={formatMonto(deudaTotal)}
          icon={<CreditCard className="w-5 h-5" />}
          color="red"
          sub={`${pagosVencidos} cuota${pagosVencidos !== 1 ? "s" : ""} vencida${pagosVencidos !== 1 ? "s" : ""}`}
        />
        <SummaryCard
          label="Cuotas Pagadas"
          value={`${MOCK_PAGOS.filter((p) => p.estado === "pagado").length} / ${MOCK_PAGOS.length}`}
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
          sub="Al día"
        />
        <SummaryCard
          label="Trámites Activos"
          value={String(tramitesPend)}
          icon={<Clock className="w-5 h-5" />}
          color="yellow"
          sub="En proceso"
        />
        <SummaryCard
          label="Trámites Completados"
          value={String(tramitesOk)}
          icon={<TrendingUp className="w-5 h-5" />}
          color="blue"
          sub="Disponibles"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Avisos */}
        <div className="lg:col-span-2 card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-mcm-muted" />
              <h2 className="font-semibold text-mcm-text">Avisos y alertas</h2>
            </div>
          </div>
          <div className="space-y-3">
            {MOCK_AVISOS.map((aviso) => {
              const s = AVISO_STYLES[aviso.tipo];
              return (
                <div key={aviso.id} className={clsx("flex gap-3 border rounded-xl p-3.5", s.bg)}>
                  <div className={clsx("w-2 h-2 rounded-full mt-1.5 shrink-0", s.dot)} />
                  <div>
                    <p className="text-sm font-medium text-mcm-text">{aviso.titulo}</p>
                    <p className="text-xs text-mcm-muted mt-0.5">{aviso.descripcion}</p>
                    <p className="text-xs text-mcm-muted mt-1">{formatFecha(aviso.fecha)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-mcm-text">Accesos rápidos</h2>
          <div className="space-y-2">
            <QuickLink href="/dashboard/pagos"    icon={<CreditCard size={16} />}  label="Ver estado de cuenta" />
            <QuickLink href="/dashboard/tramites" icon={<FileText size={16} />}    label="Solicitar trámite"    />
            <QuickLink href="/dashboard/tramites" icon={<AlertTriangle size={16} />} label="Trámites pendientes" />
          </div>

          {/* Próximo vencimiento */}
          <div className="mt-4 pt-4 border-t border-mcm-border">
            <p className="text-xs font-medium text-mcm-muted mb-2">Próximo vencimiento</p>
            {(() => {
              const prox = MOCK_PAGOS.find((p) => p.estado === "pendiente");
              return prox ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <p className="text-sm font-semibold text-mcm-text">{prox.concepto}</p>
                  <p className="text-xs text-mcm-muted mt-0.5">{formatFecha(prox.vencimiento)}</p>
                  <p className="text-base font-bold text-yellow-700 mt-1">{formatMonto(prox.monto)}</p>
                </div>
              ) : (
                <p className="text-sm text-green-600 font-medium">Sin vencimientos próximos</p>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Últimos trámites */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-mcm-text">Mis trámites recientes</h2>
          <Link href="/dashboard/tramites" className="text-sm text-mcm-primary hover:underline flex items-center gap-1">
            Ver todos <ArrowRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mcm-border">
                <th className="text-left py-2 px-3 text-mcm-muted font-medium">Tipo</th>
                <th className="text-left py-2 px-3 text-mcm-muted font-medium">Fecha</th>
                <th className="text-left py-2 px-3 text-mcm-muted font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TRAMITES.slice(0, 3).map((t) => (
                <tr key={t.id} className="border-b border-mcm-border last:border-0 hover:bg-slate-50">
                  <td className="py-3 px-3 font-medium text-mcm-text">{t.tipo}</td>
                  <td className="py-3 px-3 text-mcm-muted">{formatFecha(t.fechaSolicitud)}</td>
                  <td className="py-3 px-3"><EstadoBadge estado={t.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, color, sub }: {
  label: string; value: string; icon: React.ReactNode; color: "red"|"green"|"yellow"|"blue"; sub: string;
}) {
  const colors = {
    red:    "bg-red-50 text-red-600",
    green:  "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    blue:   "bg-blue-50 text-blue-600",
  };
  return (
    <div className="card flex items-start gap-4">
      <div className={clsx("p-2.5 rounded-xl shrink-0", colors[color])}>{icon}</div>
      <div>
        <p className="text-xs text-mcm-muted font-medium">{label}</p>
        <p className="text-xl font-bold text-mcm-text mt-0.5">{value}</p>
        <p className="text-xs text-mcm-muted mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 border border-mcm-border transition-colors text-sm text-mcm-text font-medium"
    >
      <span className="text-mcm-primary">{icon}</span>
      <span className="flex-1">{label}</span>
      <ArrowRight size={14} className="text-mcm-muted" />
    </Link>
  );
}
