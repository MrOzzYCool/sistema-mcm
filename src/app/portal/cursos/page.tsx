"use client";

import { BookOpen, Clock, User, TrendingUp } from "lucide-react";

const CURSOS = [
  { id: 1, nombre: "Contabilidad General",       docente: "Prof. Ramírez",  horario: "Lun/Mié 08:00–10:00", creditos: 4, nota: 16, estado: "En curso" },
  { id: 2, nombre: "Administración de Empresas", docente: "Prof. Torres",   horario: "Mar/Jue 10:00–12:00", creditos: 4, nota: 14, estado: "En curso" },
  { id: 3, nombre: "Marketing Digital",          docente: "Prof. Vargas",   horario: "Vie 14:00–18:00",     creditos: 3, nota: 18, estado: "En curso" },
  { id: 4, nombre: "Derecho Empresarial",        docente: "Prof. Castillo", horario: "Lun/Mié 14:00–16:00", creditos: 3, nota: 15, estado: "En curso" },
  { id: 5, nombre: "Estadística Aplicada",       docente: "Prof. Huanca",   horario: "Mar/Jue 08:00–10:00", creditos: 4, nota: 13, estado: "En curso" },
];

function notaColor(nota: number) {
  if (nota >= 17) return "text-green-600 bg-green-50";
  if (nota >= 14) return "text-blue-600 bg-blue-50";
  if (nota >= 11) return "text-yellow-600 bg-yellow-50";
  return "text-red-600 bg-red-50";
}

export default function CursosPage() {
  const promedio = (CURSOS.reduce((a, c) => a + c.nota, 0) / CURSOS.length).toFixed(1);
  const totalCreditos = CURSOS.reduce((a, c) => a + c.creditos, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">Mis Cursos</h1>
        <p className="text-mcm-muted text-sm mt-0.5">Semestre 2026-I</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4 bg-gradient-to-r from-[#8a2b1f] to-[#a93526] text-white border-0">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white/70 text-xs">Promedio</p>
            <p className="text-3xl font-bold">{promedio}</p>
          </div>
        </div>
        <div className="card">
          <p className="text-xs text-mcm-muted">Cursos matriculados</p>
          <p className="text-2xl font-bold text-mcm-text mt-1">{CURSOS.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-mcm-muted">Créditos totales</p>
          <p className="text-2xl font-bold text-mcm-text mt-1">{totalCreditos}</p>
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
              <span className="badge-green">{curso.estado}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
