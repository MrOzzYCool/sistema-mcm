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
import type { GerenciaFilters, TramiteRow, TramitesCounts } from "@/types/gerencia";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ["gerenta", "super_admin"];
const PAGE_LIMIT = 50;

const ESTADO_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "pendiente", label: "Pendiente" },
  { value: "aprobado", label: "Aprobado" },
  { value: "observado", label: "Observado" },
  { value: "rechazado", label: "Rechazado" },
];

const ESTADO_BADGE_STYLES: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-700",
  aprobado: "bg-green-100 text-green-700",
  observado: "bg-blue-100 text-blue-700",
  rechazado: "bg-red-100 text-red-700",
};

// ─── Page Component ──────────────────────────────────────────────────────────

export default function GerenciaTramitesPage() {
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
      <TramitesContent />
    </GerenciaLayout>
  );
}

// ─── Tramites Content ────────────────────────────────────────────────────────

function TramitesContent() {
  const [filters, setFilters] = useState<GerenciaFilters>({
    from: getFirstDayOfMonth(),
    to: getLastDayOfMonth(),
  });
  const [estado, setEstado] = useState<string>("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<TramiteRow[]>([]);
  const [counts, setCounts] = useState<TramitesCounts | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        page: String(page),
        limit: String(PAGE_LIMIT),
      });
      if (filters.carrera) params.set("carrera", filters.carrera);
      if (filters.ciclo !== undefined) params.set("ciclo", String(filters.ciclo));
      if (estado) params.set("estado", estado);

      const response = await fetch(
        `/api/admin/reports/tramites?${params.toString()}`,
        { headers }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error ?? "Error al cargar los datos de trámites");
      }

      const data = await response.json();

      setItems(data.items ?? []);
      setCounts(data.counts ?? { pendiente: 0, aprobado: 0, observado: 0, rechazado: 0 });
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [filters, estado, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  function handleFiltersChange(newFilters: GerenciaFilters) {
    setFilters(newFilters);
    setPage(1);
  }

  function handleEstadoChange(newEstado: string) {
    setEstado(newEstado);
    setPage(1);
  }

  // Pagination calculations
  const totalPages = Math.ceil(total / PAGE_LIMIT);
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const endItem = Math.min(page * PAGE_LIMIT, total);

  // ─── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <GerenciaFiltersComponent filters={filters} onFiltersChange={handleFiltersChange} />
        <div className="flex items-center justify-center py-20 gap-3 text-mcm-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando trámites...</span>
        </div>
      </div>
    );
  }

  // ─── Error State ───────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="space-y-6">
        <GerenciaFiltersComponent filters={filters} onFiltersChange={handleFiltersChange} />
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
          <GerenciaFiltersComponent filters={filters} onFiltersChange={handleFiltersChange} />
        </div>
        <div className="shrink-0">
          <ExportButtons type="tramites" filters={filters} />
        </div>
      </div>

      {/* Estado filter */}
      <div className="bg-white dark:bg-mcm-card rounded-xl border border-mcm-border p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-mcm-text mb-1.5">
              Estado
            </label>
            <select
              value={estado}
              onChange={(e) => handleEstadoChange(e.target.value)}
              className="w-full sm:w-48 border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition bg-white"
            >
              {ESTADO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Counts summary */}
          {counts && (
            <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
              <CountBadge label="Pendiente" count={counts.pendiente} color="yellow" />
              <CountBadge label="Aprobado" count={counts.aprobado} color="green" />
              <CountBadge label="Observado" count={counts.observado} color="blue" />
              <CountBadge label="Rechazado" count={counts.rechazado} color="red" />
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {items.length === 0 ? (
          <p className="text-sm text-mcm-muted py-8 text-center">
            No hay trámites para el periodo y filtros seleccionados
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mcm-border">
                    {["Fecha", "Tipo de Trámite", "Alumno", "Costo", "Estado"].map((h) => (
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
                  {items.map((item, idx) => (
                    <tr
                      key={item.id ?? idx}
                      className="border-b border-mcm-border last:border-0 hover:bg-slate-50"
                    >
                      <td className="py-3 px-3 text-mcm-muted text-xs">
                        {formatDate(item.fecha)}
                      </td>
                      <td className="py-3 px-3 font-medium text-mcm-text text-xs">
                        {item.tipo_tramite}
                      </td>
                      <td className="py-3 px-3 text-mcm-text text-xs">
                        {item.alumno}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs">
                        S/ {Number(item.costo).toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        <EstadoBadge estado={item.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-mcm-border">
              <p className="text-xs text-mcm-muted">
                Mostrando {startItem}–{endItem} de {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-mcm-border text-mcm-text hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Anterior
                </button>
                <span className="text-xs text-mcm-muted px-2">
                  Página {page} de {totalPages || 1}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-mcm-border text-mcm-text hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CountBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "yellow" | "green" | "blue" | "red";
}) {
  const styles = {
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    green: "bg-green-50 text-green-700 border-green-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[color]}`}>
      {label}: {count}
    </span>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const style = ESTADO_BADGE_STYLES[estado] ?? "bg-gray-100 text-gray-700";
  const label = estado.charAt(0).toUpperCase() + estado.slice(1);

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
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
