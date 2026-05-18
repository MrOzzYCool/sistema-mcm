"use client";

import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import GerenciaLayout from "@/components/gerencia/GerenciaLayout";
import GerenciaFiltersComponent, {
  getFirstDayOfMonth,
} from "@/components/gerencia/GerenciaFilters";
import ExportButtons from "@/components/gerencia/ExportButtons";
import type {
  GerenciaFilters,
  FinancialSummary,
  MonthlyFinancial,
  TramitesCounts,
  VoucherRow,
} from "@/types/gerencia";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Loader2,
  AlertCircle,
  TrendingUp,
  Banknote,
  Percent,
  ExternalLink,
  FileText,
  CreditCard,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ["gerenta", "super_admin"];

const DONUT_COLORS: Record<string, string> = {
  pendiente: "#eab308",
  aprobado: "#22c55e",
  observado: "#3b82f6",
  rechazado: "#ef4444",
};

const DONUT_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  observado: "Observado",
  rechazado: "Rechazado",
};

// ─── Page Component ──────────────────────────────────────────────────────────

export default function GerenciaDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Role guard
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      setAccessDenied(true);
      const timeout = setTimeout(() => {
        router.push("/dashboard/tramites-externos");
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-mcm-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando...</span>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-xl font-bold text-mcm-text">Acceso denegado</h2>
        <p className="text-sm text-mcm-muted">
          No tienes permisos para acceder a esta sección. Redirigiendo...
        </p>
      </div>
    );
  }

  return (
    <GerenciaLayout>
      <DashboardContent />
    </GerenciaLayout>
  );
}

// ─── Dashboard Content ───────────────────────────────────────────────────────

function DashboardContent() {
  const [filters, setFilters] = useState<GerenciaFilters>({
    from: getFirstDayOfMonth(),
    to: new Date().toISOString().slice(0, 10), // Hoy
  });

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyFinancial[]>([]);
  const [tramitesCounts, setTramitesCounts] = useState<TramitesCounts | null>(null);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter options from DB
  const [carreras, setCarreras] = useState<{ id: string; nombre: string }[]>([]);
  const [ciclos, setCiclos] = useState<number[]>([]);

  // Fetch filter options once on mount
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/admin/reports/filter-options", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setCarreras(data.carreras ?? []);
          setCiclos(data.ciclos ?? []);
        }
      } catch {
        // Non-critical — filters will just show empty dropdowns
      }
    }
    loadFilterOptions();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Sesión expirada. Por favor inicia sesión nuevamente.");
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${session.access_token}` };

      // Build query params
      const params = new URLSearchParams({
        from: filters.from,
        to: filters.to,
      });
      if (filters.carrera) params.set("carrera", filters.carrera);
      if (filters.ciclo !== undefined) params.set("ciclo", String(filters.ciclo));

      const financialParams = new URLSearchParams(params);
      financialParams.set("group_by", "month");

      // Fetch all endpoints in parallel
      const [summaryRes, financialsRes, tramitesRes] = await Promise.all([
        fetch(`/api/admin/reports/summary?${params.toString()}`, { headers }),
        fetch(`/api/admin/reports/financials?${financialParams.toString()}`, { headers }),
        fetch(`/api/admin/reports/tramites?${params.toString()}`, { headers }),
      ]);

      if (!summaryRes.ok || !financialsRes.ok || !tramitesRes.ok) {
        const failedRes = [summaryRes, financialsRes, tramitesRes].find((r) => !r.ok);
        const errData = await failedRes?.json().catch(() => null);
        throw new Error(errData?.error ?? "Error al cargar los datos");
      }

      const summaryData = await summaryRes.json();
      const financialsData = await financialsRes.json();
      const tramitesData = await tramitesRes.json();

      setSummary({
        total_pagado: summaryData.total_pagado ?? 0,
        total_pendiente: summaryData.total_pendiente ?? 0,
        total_ingresos: summaryData.total_ingresos ?? 0,
        total_egresos: summaryData.total_egresos ?? 0,
        porcentaje_cobranza: summaryData.porcentaje_cobranza ?? 0,
      });

      setMonthlyData(financialsData.data ?? []);
      setTramitesCounts(tramitesData.counts ?? { pendiente: 0, aprobado: 0, observado: 0, rechazado: 0 });
      setVouchers(summaryData.vouchers_recientes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleFiltersChange(newFilters: GerenciaFilters) {
    setFilters(newFilters);
  }

  // ─── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <GerenciaFiltersComponent filters={filters} onFiltersChange={handleFiltersChange} carreras={carreras} ciclos={ciclos} />
        <div className="flex items-center justify-center py-20 gap-3 text-mcm-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando datos del dashboard...</span>
        </div>
      </div>
    );
  }

  // ─── Error State ───────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="space-y-6">
        <GerenciaFiltersComponent filters={filters} onFiltersChange={handleFiltersChange} carreras={carreras} ciclos={ciclos} />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-mcm-primary text-white hover:bg-mcm-dark transition"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Content ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Filters + Export */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <GerenciaFiltersComponent filters={filters} onFiltersChange={handleFiltersChange} carreras={carreras} ciclos={ciclos} />
        </div>
        <div className="shrink-0">
          <ExportButtons type="financials" filters={filters} />
        </div>
      </div>

      {/* KPI Cards */}
      {summary && <KpiSection summary={summary} />}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart: Ingresos vs Egresos */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-mcm-muted" />
            <h3 className="font-semibold text-mcm-text">Ingresos vs Egresos</h3>
          </div>
          {monthlyData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-sm text-mcm-muted">
              No hay datos financieros para el periodo seleccionado
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    tickFormatter={(v) => {
                      const parts = v.split("-");
                      return parts.length === 2 ? `${parts[1]}/${parts[0].slice(2)}` : v;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    tickFormatter={(v) => `S/${Number(v).toLocaleString()}`}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `S/ ${Number(value).toFixed(2)}`,
                      name === "ingresos" ? "Ingresos" : "Egresos",
                    ]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                  />
                  <Legend
                    formatter={(value) => (value === "ingresos" ? "Ingresos" : "Egresos")}
                  />
                  <Line
                    type="monotone"
                    dataKey="ingresos"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="egresos"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Donut Chart: Trámites por Estado */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-mcm-muted" />
            <h3 className="font-semibold text-mcm-text">Trámites por Estado</h3>
          </div>
          {tramitesCounts && <DonutChart counts={tramitesCounts} />}
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-mcm-muted" />
          <h3 className="font-semibold text-mcm-text">Últimos Vouchers</h3>
        </div>
        <VouchersTable vouchers={vouchers} />
      </div>
    </div>
  );
}

// ─── KPI Section ─────────────────────────────────────────────────────────────

function KpiSection({ summary }: { summary: FinancialSummary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KpiCard
        label="Total Pagado"
        value={`S/ ${summary.total_pagado.toFixed(2)}`}
        icon={<Banknote className="w-5 h-5" />}
        color="green"
      />
      <KpiCard
        label="Total Pendiente"
        value={`S/ ${summary.total_pendiente.toFixed(2)}`}
        icon={<CreditCard className="w-5 h-5" />}
        color="yellow"
      />
      <KpiCard
        label="% Cobranza"
        value={`${summary.porcentaje_cobranza.toFixed(1)}%`}
        icon={<Percent className="w-5 h-5" />}
        color="blue"
      />
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "green" | "yellow" | "blue" | "red";
}) {
  const styles = {
    green: { bg: "bg-green-50", text: "text-green-600", border: "border-l-green-500" },
    yellow: { bg: "bg-yellow-50", text: "text-yellow-600", border: "border-l-yellow-500" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-l-blue-500" },
    red: { bg: "bg-red-50", text: "text-red-600", border: "border-l-red-500" },
  };
  const s = styles[color];

  return (
    <div className={`card flex items-start gap-3 border-l-4 py-4 px-4 ${s.border}`}>
      <div className={`p-2.5 rounded-xl shrink-0 ${s.bg} ${s.text}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-mcm-muted font-medium uppercase tracking-wide truncate">
          {label}
        </p>
        <p className="text-lg font-bold text-mcm-text mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────

function DonutChart({ counts }: { counts: TramitesCounts }) {
  const total = counts.pendiente + counts.aprobado + counts.observado + counts.rechazado;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-mcm-muted">
        No hay trámites para el periodo seleccionado
      </div>
    );
  }

  const data = [
    { name: "pendiente", value: counts.pendiente },
    { name: "aprobado", value: counts.aprobado },
    { name: "observado", value: counts.observado },
    { name: "rechazado", value: counts.rechazado },
  ].filter((d) => d.value > 0);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            label={({ name, value }: { name?: string; value?: number }) => {
              const pct = ((Number(value ?? 0) / total) * 100).toFixed(1);
              const key = name ?? "";
              return `${DONUT_LABELS[key] ?? key} (${value ?? 0} - ${pct}%)`;
            }}
            labelLine={{ strokeWidth: 1 }}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={DONUT_COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              `${value} (${((Number(value) / total) * 100).toFixed(1)}%)`,
              DONUT_LABELS[name as string] ?? name,
            ]}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Vouchers Table ──────────────────────────────────────────────────────────

function VouchersTable({ vouchers }: { vouchers: VoucherRow[] }) {
  if (vouchers.length === 0) {
    return (
      <p className="text-sm text-mcm-muted py-8 text-center">
        No hay vouchers recientes para mostrar
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-mcm-border">
            {["Alumno", "Monto", "Fecha", "Estado", "Comprobante"].map((h) => (
              <th
                key={h}
                className="text-left py-2.5 px-3 text-mcm-muted font-medium text-xs uppercase tracking-wide"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vouchers.map((v, idx) => (
            <tr
              key={v.id ?? idx}
              className="border-b border-mcm-border last:border-0 hover:bg-slate-50"
            >
              <td className="py-3 px-3 font-medium text-mcm-text text-xs">
                {v.alumno_nombre}
              </td>
              <td className="py-3 px-3 font-mono text-xs">
                S/ {Number(v.monto).toFixed(2)}
              </td>
              <td className="py-3 px-3 text-mcm-muted text-xs">
                {formatVoucherDate(v.fecha)}
              </td>
              <td className="py-3 px-3">
                <VoucherStatusBadge status={v.status} />
              </td>
              <td className="py-3 px-3 text-xs">
                {v.comprobante_url ? (
                  <a
                    href={v.comprobante_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-mcm-primary hover:underline"
                  >
                    Ver <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-mcm-muted">Sin comprobante</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatVoucherDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function VoucherStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    rejected: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    approved: "Aprobado",
    pending: "Pendiente",
    rejected: "Rechazado",
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
        styles[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}
