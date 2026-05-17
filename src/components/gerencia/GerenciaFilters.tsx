"use client";

import { useState } from "react";
import { GerenciaFilters } from "@/types/gerencia";
import { AlertCircle } from "lucide-react";

export interface CarreraOption {
  id: string;
  nombre: string;
}

interface GerenciaFiltersProps {
  filters: GerenciaFilters;
  onFiltersChange: (filters: GerenciaFilters) => void;
  carreras?: CarreraOption[];
  ciclos?: number[];
}

/** Returns the first day of the current month in YYYY-MM-DD format */
export function getFirstDayOfMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

/** Returns the last day of the current month in YYYY-MM-DD format */
export function getLastDayOfMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export default function GerenciaFiltersComponent({
  filters,
  onFiltersChange,
  carreras = [],
  ciclos = [],
}: GerenciaFiltersProps) {
  const [dateError, setDateError] = useState<string | null>(null);

  function handleChange(field: keyof GerenciaFilters, value: string | number | undefined) {
    const updated: GerenciaFilters = { ...filters, [field]: value };

    // Validate date range
    if (updated.from && updated.to && updated.from > updated.to) {
      setDateError("La fecha 'desde' no puede ser posterior a 'hasta'");
      return;
    }

    setDateError(null);
    onFiltersChange(updated);
  }

  return (
    <div className="bg-white dark:bg-mcm-card rounded-xl border border-mcm-border p-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date From */}
        <div>
          <label className="block text-sm font-medium text-mcm-text dark:text-mcm-text mb-1.5">
            Desde
          </label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => handleChange("from", e.target.value)}
            className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-sm font-medium text-mcm-text dark:text-mcm-text mb-1.5">
            Hasta
          </label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => handleChange("to", e.target.value)}
            className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition"
          />
        </div>

        {/* Carrera Dropdown */}
        <div>
          <label className="block text-sm font-medium text-mcm-text dark:text-mcm-text mb-1.5">
            Carrera
          </label>
          <select
            value={filters.carrera ?? ""}
            onChange={(e) =>
              handleChange("carrera", e.target.value || undefined)
            }
            className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition bg-white"
          >
            <option value="">Todas las carreras</option>
            {carreras.map((c) => (
              <option key={c.id} value={c.nombre}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Ciclo Dropdown */}
        <div>
          <label className="block text-sm font-medium text-mcm-text dark:text-mcm-text mb-1.5">
            Ciclo
          </label>
          <select
            value={filters.ciclo ?? ""}
            onChange={(e) =>
              handleChange(
                "ciclo",
                e.target.value ? Number(e.target.value) : undefined
              )
            }
            className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition bg-white"
          >
            <option value="">Todos los ciclos</option>
            {ciclos.map((c) => (
              <option key={c} value={c}>
                Ciclo {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date validation error */}
      {dateError && (
        <div className="flex items-center gap-2 mt-3 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{dateError}</span>
        </div>
      )}
    </div>
  );
}
