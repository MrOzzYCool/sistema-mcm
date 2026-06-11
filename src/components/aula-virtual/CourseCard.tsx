"use client";

import { User } from "lucide-react";
import Link from "next/link";

export interface CourseCardProps {
  id?: string;
  codigo?: string | null;
  nombre: string | null;
  profesor: string | null;
  progreso: number | null;
  modalidad: string | null;
  periodo?: string | null;
  carrera?: string | null;
  imagen_url?: string | null;
}

function Placeholder() {
  return <span className="text-gray-400 italic text-xs">No disponible</span>;
}

export default function CourseCard({
  id,
  codigo,
  nombre,
  profesor,
  progreso,
  modalidad,
  periodo,
  carrera,
  imagen_url,
}: CourseCardProps) {
  const hasNombre = nombre !== null && nombre !== "";
  const hasProfesor = profesor !== null && profesor !== "";
  const hasModalidad = modalidad !== null && modalidad !== "";
  const hasProgreso = progreso !== null;
  const hasPeriodo = periodo !== null && periodo !== undefined && periodo !== "";
  const hasCarrera = carrera !== null && carrera !== undefined && carrera !== "";
  const progressWidth = hasProgreso ? progreso : 0;

  const imageUrl =
    imagen_url && imagen_url.trim() !== ""
      ? imagen_url
      : id
        ? `https://picsum.photos/seed/${id}/400/200`
        : `https://picsum.photos/seed/default/400/200`;

  const linkHref = codigo
    ? `/aula-virtual/cursos/${codigo}`
    : id
      ? `/aula-virtual/cursos/${id}`
      : "#";

  const cardContent = (
    <>
      <div className="aspect-[16/9] relative overflow-hidden rounded-t-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={nombre || "Curso"}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {hasModalidad && (
          <span className="absolute bottom-2 left-2 text-xs bg-white/90 text-gray-700 px-2 py-0.5 rounded-full font-medium">
            {modalidad}
          </span>
        )}
      </div>
      <div className="p-2">
        <h3 className="font-semibold text-[13px] line-clamp-2 leading-tight">
          {hasNombre ? nombre : <Placeholder />}
        </h3>
        <p className="text-[10px] text-gray-500 mt-0.5 truncate">
          {hasPeriodo || hasCarrera ? (
            <>
              {hasPeriodo && <span>{periodo}</span>}
              {hasPeriodo && hasCarrera && <span> · </span>}
              {hasCarrera && <span>{carrera}</span>}
            </>
          ) : (
            <Placeholder />
          )}
        </p>
        <div className="mt-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-gray-500">Progreso</span>
            <span className="text-[10px] text-gray-500">
              {hasProgreso ? `${progreso}%` : <Placeholder />}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-[#C62828] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progressWidth}%` }}
            />
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 pt-1.5 border-t border-gray-100">
          <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <User size={10} className="text-gray-500" />
          </div>
          <p className="text-[10px] text-gray-600 truncate">
            {hasProfesor ? profesor : <Placeholder />}
          </p>
        </div>
      </div>
    </>
  );

  const cardClasses =
    "block rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow duration-200 overflow-hidden";

  if (id || codigo) {
    return (
      <Link href={linkHref} className={cardClasses}>
        {cardContent}
      </Link>
    );
  }
  return <div className={cardClasses}>{cardContent}</div>;
}
