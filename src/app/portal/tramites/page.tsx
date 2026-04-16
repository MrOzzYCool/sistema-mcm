"use client";

import { FileText, GraduationCap, Award, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

const CATEGORIAS = [
  {
    titulo: "Autogestionables",
    desc: "Solicita documentos directamente",
    icon: <FileText size={20} />,
    color: "bg-blue-50 text-blue-600",
    items: ["Constancia de Estudios", "Constancia de Matrícula", "Récord de Notas"],
  },
  {
    titulo: "Becas y Convenios",
    desc: "Postula a beneficios económicos",
    icon: <Award size={20} />,
    color: "bg-green-50 text-green-600",
    items: ["Beca por Excelencia", "Beca Socioeconómica", "Convenios Empresariales"],
  },
  {
    titulo: "Solicitudes SAE",
    desc: "Atención al estudiante",
    icon: <GraduationCap size={20} />,
    color: "bg-yellow-50 text-yellow-600",
    items: ["Retiro de Curso", "Cambio de Horario", "Justificación de Inasistencia"],
  },
];

const HISTORIAL = [
  { tipo: "Constancia de Estudios", fecha: "10 Mar 2026", estado: "aprobado" },
  { tipo: "Récord de Notas",       fecha: "28 Feb 2026", estado: "aprobado" },
  { tipo: "Retiro de Curso",       fecha: "15 Feb 2026", estado: "pendiente" },
];

export default function TramitesAlumnoPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">Trámites</h1>
        <p className="text-mcm-muted text-sm mt-0.5">Solicita documentos y gestiona tus trámites</p>
      </div>

      {/* Categorías */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CATEGORIAS.map((cat) => (
          <div key={cat.titulo} className="card space-y-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${cat.color}`}>{cat.icon}</div>
              <div>
                <h3 className="font-semibold text-mcm-text text-sm">{cat.titulo}</h3>
                <p className="text-xs text-mcm-muted">{cat.desc}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {cat.items.map((item) => (
                <button key={item}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-mcm-border hover:border-[#a93526] hover:bg-red-50 text-sm text-mcm-text transition-colors">
                  <span>{item}</span>
                  <ArrowRight size={14} className="text-mcm-muted" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Historial */}
      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-mcm-border flex items-center gap-2">
          <Clock size={16} className="text-mcm-muted" />
          <h2 className="font-semibold text-mcm-text">Historial de trámites</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Trámite", "Fecha", "Estado"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HISTORIAL.map((t, i) => (
                <tr key={i} className="border-t border-mcm-border hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium text-mcm-text">{t.tipo}</td>
                  <td className="py-3 px-4 text-mcm-muted">{t.fecha}</td>
                  <td className="py-3 px-4">
                    <span className={t.estado === "aprobado" ? "badge-green" : "badge-yellow"}>
                      {t.estado === "aprobado" ? "Aprobado" : "Pendiente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
