"use client";

import { BookOpen, Clock, User } from "lucide-react";

const CURSOS = [
  { id: 1, nombre: "Contabilidad General",       docente: "Prof. Ramírez",  horario: "Lun/Mié 08:00–10:00", creditos: 4, nota: 16 },
  { id: 2, nombre: "Administración de Empresas", docente: "Prof. Torres",   horario: "Mar/Jue 10:00–12:00", creditos: 4, nota: 14 },
  { id: 3, nombre: "Marketing Digital",          docente: "Prof. Vargas",   horario: "Vie 14:00–18:00",     creditos: 3, nota: 18 },
  { id: 4, nombre: "Derecho Empresarial",        docente: "Prof. Castillo", horario: "Lun/Mié 14:00–16:00", creditos: 3, nota: 15 },
  { id: 5, nombre: "Estadística Aplicada",       docente: "Prof. Huanca",   horario: "Mar/Jue 08:00–10:00", creditos: 4, nota: 13 },
];

function notaColor(nota: number) {
  if (nota >= 17) return "text-green-600 bg-green-50";
  if (nota >= 14) return "text-blue-600 bg-blue-50";
  if (nota >= 11) return "text-yellow-600 bg-yellow-50";
  return "text-red-600 bg-red-50";
}

export default function CursosPage() {
  const promedio = (CURSOS.reduce((a, c) => a + c.nota, 0) / CURSOS.length).toFixed(1);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">Mis Cursos</h1>
        <p className="text-mcm-muted text-sm mt-0.5">IV Ciclo – 2024-I</p>
      </div>

      {/* Promedio */}
      <div className="card flex items-center gap-4 bg-gradient-to-r from-[#8a2b1f] to-[#a93526] text-white border-0">
        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-white" />
        </div>
        <div>
          <p className="text-blue-100 text-sm">Promedio ponderado</p>
          <p className="text-4xl font-bold">{promedio}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-blue-100 text-sm">{CURSOS.length} cursos</p>
          <p className="text-blue-100 text-sm">{CURSOS.reduce((a, c) => a + c.creditos, 0)} créditos</p>
        </div>
      </div>

      {/* Grid de cursos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CURSOS.map((curso) => (
          <div key={curso.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-mcm-primary" />
              </div>
              <span className={`text-lg font-bold px-2.5 py-0.5 rounded-lg ${notaColor(curso.nota)}`}>
                {curso.nota}
              </span>
            </div>
            <h3 className="font-semibold text-mcm-text text-sm leading-tight">{curso.nombre}</h3>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-mcm-muted">
                <User size={12} /> {curso.docente}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-mcm-muted">
                <Clock size={12} /> {curso.horario}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-mcm-border flex justify-between text-xs text-mcm-muted">
              <span>{curso.creditos} créditos</span>
              <span className="text-mcm-primary font-medium">Ver detalle →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
