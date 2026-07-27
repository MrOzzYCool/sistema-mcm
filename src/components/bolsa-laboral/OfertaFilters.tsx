"use client";

import { useState, useEffect, useCallback } from "react";
import { OfertaLaboral, ModalidadOferta } from "@/lib/bolsa-laboral/types";
import { SlidersHorizontal } from "lucide-react";

export interface OfertaFiltersProps {
  ofertas: OfertaLaboral[];
  onFilter: (filtered: OfertaLaboral[]) => void;
}

const MODALIDAD_OPTIONS: { value: ModalidadOferta | ""; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "presencial", label: "Presencial" },
  { value: "remoto", label: "Remoto" },
  { value: "hibrido", label: "Híbrido" },
];

/**
 * Applies client-side filtering to the offers list.
 * - Modalidad: shows only matching offers, or all if "Todas" selected.
 * - Salary range overlap: sueldo_max >= min_filter AND sueldo_min <= max_filter.
 *   If salary fields are empty, salary filter is not applied.
 *   Offers with null salary fields are included when no salary filter is active,
 *   and excluded only when they cannot satisfy the range overlap condition.
 */
export function filterOfertas(
  ofertas: OfertaLaboral[],
  modalidad: ModalidadOferta | "",
  salarioMin: number | null,
  salarioMax: number | null
): OfertaLaboral[] {
  return ofertas.filter((oferta) => {
    // Modalidad filter
    if (modalidad && oferta.modalidad !== modalidad) {
      return false;
    }

    // Salary range overlap filter
    if (salarioMin !== null) {
      // sueldo_max >= min_filter (offer's max must reach at least the user's minimum)
      // If the offer has no sueldo_max, we can't confirm overlap → exclude
      if (oferta.sueldo_max === null) return false;
      if (oferta.sueldo_max < salarioMin) return false;
    }

    if (salarioMax !== null) {
      // sueldo_min <= max_filter (offer's min must be at most the user's maximum)
      // If the offer has no sueldo_min, we can't confirm overlap → exclude
      if (oferta.sueldo_min === null) return false;
      if (oferta.sueldo_min > salarioMax) return false;
    }

    return true;
  });
}

export default function OfertaFilters({ ofertas, onFilter }: OfertaFiltersProps) {
  const [modalidad, setModalidad] = useState<ModalidadOferta | "">("");
  const [salarioMinStr, setSalarioMinStr] = useState("");
  const [salarioMaxStr, setSalarioMaxStr] = useState("");

  const applyFilters = useCallback(() => {
    const salarioMin = salarioMinStr ? Number(salarioMinStr) : null;
    const salarioMax = salarioMaxStr ? Number(salarioMaxStr) : null;

    const filtered = filterOfertas(ofertas, modalidad, salarioMin, salarioMax);
    onFilter(filtered);
  }, [ofertas, modalidad, salarioMinStr, salarioMaxStr, onFilter]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal size={16} className="text-gray-500" />
        <h3 className="text-sm font-medium text-gray-700">Filtros</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Modalidad filter */}
        <div>
          <label
            htmlFor="filter-modalidad"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Modalidad
          </label>
          <select
            id="filter-modalidad"
            value={modalidad}
            onChange={(e) => setModalidad(e.target.value as ModalidadOferta | "")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent focus:outline-none"
          >
            {MODALIDAD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Salary min */}
        <div>
          <label
            htmlFor="filter-salario-min"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Sueldo mínimo (S/)
          </label>
          <input
            id="filter-salario-min"
            type="number"
            min={0}
            step={100}
            placeholder="Ej: 1000"
            value={salarioMinStr}
            onChange={(e) => setSalarioMinStr(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent focus:outline-none"
          />
        </div>

        {/* Salary max */}
        <div>
          <label
            htmlFor="filter-salario-max"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Sueldo máximo (S/)
          </label>
          <input
            id="filter-salario-max"
            type="number"
            min={0}
            step={100}
            placeholder="Ej: 5000"
            value={salarioMaxStr}
            onChange={(e) => setSalarioMaxStr(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
