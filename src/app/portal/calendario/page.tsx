"use client";

import { Calendar, Clock } from "lucide-react";

const HORARIO = [
  { dia: "Lunes",     clases: [{ hora: "08:00 - 10:00", curso: "Contabilidad General", aula: "A-201" }, { hora: "14:00 - 16:00", curso: "Derecho Empresarial", aula: "B-102" }] },
  { dia: "Martes",    clases: [{ hora: "10:00 - 12:00", curso: "Administración de Empresas", aula: "A-305" }] },
  { dia: "Miércoles", clases: [{ hora: "08:00 - 10:00", curso: "Contabilidad General", aula: "A-201" }, { hora: "14:00 - 16:00", curso: "Derecho Empresarial", aula: "B-102" }] },
  { dia: "Jueves",    clases: [{ hora: "10:00 - 12:00", curso: "Administración de Empresas", aula: "A-305" }, { hora: "08:00 - 10:00", curso: "Estadística Aplicada", aula: "C-101" }] },
  { dia: "Viernes",   clases: [{ hora: "14:00 - 18:00", curso: "Marketing Digital", aula: "Lab-2" }] },
];

const EVENTOS = [
  { fecha: "14 Abr", titulo: "Inicio de clases 2026-I", tipo: "evento" },
  { fecha: "28 Abr", titulo: "Examen parcial - Contabilidad", tipo: "evaluacion" },
  { fecha: "05 May", titulo: "Entrega de proyecto - Marketing", tipo: "evaluacion" },
];

export default function CalendarioPage() {
  return (
    <div className="p-6 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">Calendario</h1>
        <p className="text-mcm-muted text-sm mt-0.5">Horarios, evaluaciones y eventos</p>
      </div>

      {/* Próximos eventos */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={16} className="text-mcm-muted" />
          <h2 className="font-semibold text-mcm-text">Próximos eventos</h2>
        </div>
        <div className="space-y-2">
          {EVENTOS.map((e, i) => (
            <div key={i} className={`flex items-center gap-4 rounded-xl p-3 ${
              e.tipo === "evaluacion" ? "bg-red-50 border border-red-200" : "bg-blue-50 border border-blue-200"
            }`}>
              <span className="text-xs font-bold w-14 shrink-0 text-center">{e.fecha}</span>
              <p className="text-sm font-medium text-mcm-text">{e.titulo}</p>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                e.tipo === "evaluacion" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
              }`}>{e.tipo === "evaluacion" ? "Evaluación" : "Evento"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Horario semanal */}
      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-mcm-border flex items-center gap-2">
          <Clock size={16} className="text-mcm-muted" />
          <h2 className="font-semibold text-mcm-text">Horario semanal</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Día", "Hora", "Curso", "Aula"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HORARIO.flatMap((d) =>
                d.clases.map((c, i) => (
                  <tr key={`${d.dia}-${i}`} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-mcm-text">{i === 0 ? d.dia : ""}</td>
                    <td className="py-3 px-4 text-mcm-muted font-mono text-xs">{c.hora}</td>
                    <td className="py-3 px-4 text-mcm-text">{c.curso}</td>
                    <td className="py-3 px-4 text-mcm-muted">{c.aula}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
