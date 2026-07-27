"use client";

import Link from "next/link";
import { OfertaLaboral } from "@/lib/bolsa-laboral/types";
import { MapPin, Briefcase } from "lucide-react";

interface OfertaCardProps {
  oferta: OfertaLaboral;
}

function formatSalary(value: number | null): string {
  if (value === null) return "";
  return `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getSalaryRange(sueldo_min: number | null, sueldo_max: number | null): string {
  if (sueldo_min !== null && sueldo_max !== null) {
    return `${formatSalary(sueldo_min)} - ${formatSalary(sueldo_max)}`;
  }
  if (sueldo_min !== null) return `Desde ${formatSalary(sueldo_min)}`;
  if (sueldo_max !== null) return `Hasta ${formatSalary(sueldo_max)}`;
  return "";
}

function getModalidadLabel(modalidad: string): string {
  switch (modalidad) {
    case "presencial": return "Presencial";
    case "remoto": return "Remoto";
    case "hibrido": return "Híbrido";
    default: return modalidad;
  }
}

function getModalidadColor(modalidad: string): string {
  switch (modalidad) {
    case "presencial": return "bg-blue-100 text-blue-700";
    case "remoto": return "bg-green-100 text-green-700";
    case "hibrido": return "bg-purple-100 text-purple-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

export default function OfertaCard({ oferta }: OfertaCardProps) {
  const salaryRange = getSalaryRange(oferta.sueldo_min, oferta.sueldo_max);

  return (
    <Link
      href={`/bolsa-laboral/oferta/${oferta.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-[#D32F2F]/30 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 truncate">
            {oferta.puesto}
          </h3>
          <p className="text-sm text-gray-600 mt-0.5">{oferta.empresa_nombre}</p>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getModalidadColor(oferta.modalidad)}`}
        >
          {getModalidadLabel(oferta.modalidad)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 flex-wrap text-sm text-gray-500">
        {salaryRange && (
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <Briefcase size={14} className="text-[#C62828]" />
            {salaryRange}
          </span>
        )}
        {oferta.ubicacion && (
          <span className="flex items-center gap-1.5">
            <MapPin size={14} />
            {oferta.ubicacion}
          </span>
        )}
      </div>
    </Link>
  );
}
