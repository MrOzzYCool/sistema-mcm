"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { GerenciaFilters } from "@/types/gerencia";

interface ExportButtonsProps {
  type: "financials" | "tramites";
  filters: GerenciaFilters;
}

export default function ExportButtons({ type, filters }: ExportButtonsProps) {
  const [loadingFormat, setLoadingFormat] = useState<"csv" | "pdf" | null>(null);

  async function handleExport(format: "csv" | "pdf") {
    setLoadingFormat(format);
    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert("Sesión expirada. Por favor inicia sesión nuevamente.");
        return;
      }

      // Build URL with query params
      const params = new URLSearchParams({
        type,
        format,
        from: filters.from,
        to: filters.to,
      });
      if (filters.carrera) params.set("carrera", filters.carrera);
      if (filters.ciclo !== undefined) params.set("ciclo", String(filters.ciclo));

      const url = `/api/admin/reports/export?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        alert(errorData?.error ?? "Error al exportar el reporte");
        return;
      }

      // Create blob and trigger download
      const blob = await response.blob();
      const filename =
        response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        `reporte-${type}-${filters.from}-${filters.to}.${format}`;

      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(anchor.href);
    } catch {
      alert("Error de red al exportar. Intenta nuevamente.");
    } finally {
      setLoadingFormat(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleExport("csv")}
        disabled={loadingFormat !== null}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-mcm-border text-mcm-text hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loadingFormat === "csv" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        Exportar CSV
      </button>

      <button
        onClick={() => handleExport("pdf")}
        disabled={loadingFormat !== null}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-mcm-primary text-white hover:bg-mcm-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loadingFormat === "pdf" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        Exportar PDF
      </button>
    </div>
  );
}
