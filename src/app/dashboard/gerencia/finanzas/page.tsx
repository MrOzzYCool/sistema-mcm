"use client";

import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import GerenciaLayout from "@/components/gerencia/GerenciaLayout";
import GerenciaFiltersComponent, {
  getFirstDayOfMonth,
  getLastDayOfMonth,
} from "@/components/gerencia/GerenciaFilters";
import ExportButtons from "@/components/gerencia/ExportButtons";
import type { GerenciaFilters, MonthlyFinancial } from "@/types/gerencia";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FinancialDetail {
  id: string;
  alumno: string;
  carrera: string;
  ciclo: number;
  concepto: string;
  monto: number;
  estado: string;
  due_date: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ["gerenta", "super_admin"];
const PAGE_SIZE = 50;

// ─── Page Component ──────────────────────────────────────────────────────────

export default function FinanzasPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
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
        <p className="text-sm text-mcm-muted">Redirigiendo...</p>
      </div>
    );
  }

  return (
    <GerenciaLayout>
      <FinanzasContent />
    </GerenciaLayout>
  );
}

// ─── Finanzas Content ────────────────────────────────────────────────────────

function FinanzasContent() {
  const [filters, setFilters] = useState<GerenciaFilters>({
    from: getFirstDayOfMonth(),
    to: getLastDayOfMonth(),
  });

  const [monthlySummary, setMonthlySummary] = useState<MonthlyFinancial[]>([]);
  const [detailItems, setDetailItems] = useState<FinancialDetail[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPage, setDetailPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter options from DB
  const [carreras, setCarreras] = useState<{ id: string; nombre: string }[]>([]);
  const [ciclos, setCiclos] = useState<number[]>([]);

  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/admin/reports/filter-options", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const d = await res.json();
          setCarreras(d.carreras ?? []);
          setCiclos(d.ciclos ?? []);
        }
      } catch { /* non-critical */ }
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

      const params = new URLSearchParams({
        from: filters.from,
        to: filters.to,
        group_by: "month",
        page: String(detailPage),
        limit: String(PAGE_SIZE),
      });
      if (filters.carrera) params.set("carrera", filters.carrera);
      if (filters.ciclo !== undefined) params.set("ciclo", String(filters.ciclo));

      const response = await fetch(
        `/api/admin/reports/financials?${params.toString()}`,
        { headers }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error ?? "Error al cargar los datos financieros");
      }

      const result = await response.json();
      setMonthlySummary(result.data ?? []);
      setDetailItems(result.detail?.items ?? []);
      setDetailTotal(result.detail?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [filters, detailPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleFiltersChange(newFilters: GerenciaFilters) {
    setFilters(newFilters);
    setDetailPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(detailTotal / PAGE_SIZE));

  // ─── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <GerenciaFiltersComponent filters={filters} onFiltersChange={handleFiltersChange} carreras={carreras} ciclos={ciclos} />
        <div className="flex items-center justify-center py-20 gap-3 text-mcm-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando datos financieros...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <GerenciaFiltersComponent filters={filters} onFiltersChange={handleFiltersChange} carreras={carreras} ciclos={ciclos} />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 text-sm font-medium rounded-lg bg-mcm-primary text-white hover:bg-mcm-dark transition">
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

      {/* Monthly Summary Table */}
      <div className="card">
        <h3 className="font-semibold text-mcm-text mb-4">Resumen Mensual</h3>
        <div className="overflow-x-auto">
          {monthlySummary.length === 0 ? (
            <p className="text-sm text-mcm-muted py-6 text-center">No hay datos para el periodo seleccionado</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mcm-border">
                  {["Mes", "Ingresos", "Egresos", "Balance"].map((h) => (
                    <th key={h} className="text-left py-2.5 px-3 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map((row, idx) => {
                  const balance = row.ingresos - row.egresos;
                  return (
                    <tr key={row.month ?? idx} className="border-b border-mcm-border last:border-0 hover:bg-slate-50">
                      <td className="py-3 px-3 text-mcm-text text-xs font-medium">{formatMonth(row.month)}</td>
                      <td className="py-3 px-3 font-mono text-xs text-green-600">S/ {row.ingresos.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-xs text-red-600">S/ {row.egresos.toFixed(2)}</td>
                      <td className={`py-3 px-3 font-mono text-xs font-medium ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        S/ {balance.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail Table */}
      <div className="card">
        <h3 className="font-semibold text-mcm-text mb-4">Detalle por Alumno</h3>
        <div className="overflow-x-auto">
          {detailItems.length === 0 ? (
            <p className="text-sm text-mcm-muted py-6 text-center">No hay movimientos para el periodo y filtros seleccionados</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mcm-border">
                  {["Alumno", "Carrera", "Ciclo", "Concepto", "Monto", "Estado", "Vencimiento"].map((h) => (
                    <th key={h} className="text-left py-2.5 px-3 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detailItems.map((item) => (
                  <tr key={item.id} className="border-b border-mcm-border last:border-0 hover:bg-slate-50">
                    <td className="py-3 px-3 text-mcm-text text-xs font-medium">{item.alumno}</td>
                    <td className="py-3 px-3 text-mcm-muted text-xs">{item.carrera}</td>
                    <td className="py-3 px-3 text-mcm-muted text-xs">Ciclo {item.ciclo}</td>
                    <td className="py-3 px-3 text-mcm-text text-xs">{item.concepto}</td>
                    <td className="py-3 px-3 font-mono text-xs">S/ {item.monto.toFixed(2)}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={item.estado} />
                    </td>
                    <td className="py-3 px-3 text-mcm-muted text-xs">{formatDate(item.due_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {detailTotal > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-mcm-border pt-4 mt-4 px-3">
            <p className="text-xs text-mcm-muted">
              Mostrando {(detailPage - 1) * PAGE_SIZE + 1}–{Math.min(detailPage * PAGE_SIZE, detailTotal)} de {detailTotal}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                disabled={detailPage <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-mcm-border text-mcm-text hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Anterior
              </button>
              <span className="text-xs text-mcm-muted">Página {detailPage} de {totalPages}</span>
              <button
                onClick={() => setDetailPage((p) => Math.min(totalPages, p + 1))}
                disabled={detailPage >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-mcm-border text-mcm-text hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    pending: "bg-red-100 text-red-700",
    overdue: "bg-red-100 text-red-700",
    in_review: "bg-yellow-100 text-yellow-700",
  };
  const labels: Record<string, string> = {
    paid: "Pagado",
    pending: "Pendiente",
    overdue: "Vencido",
    in_review: "En revisión",
  };

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-700"}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMonth(monthStr: string): string {
  if (!monthStr) return "—";
  try {
    const [year, month] = monthStr.split("-");
    if (!year || !month) return monthStr;
    const date = new Date(Number(year), Number(month) - 1, 1);
    if (isNaN(date.getTime())) return monthStr;
    return date.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  } catch { return monthStr; }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return dateStr; }
}
