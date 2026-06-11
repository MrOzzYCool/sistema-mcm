"use client";

import { FileText, GraduationCap, Award, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

const CATEGORIAS = [
  {
    titulo: "Autogestionables",
    desc: "Solicita documentos directamente",
    icon: <FileText size={20} />,
    color: "bg-blue-50 text-blue-600",
    items: ["Constancia de matrícula", "Constancia de notas", "Record académico"],
  },
  {
    titulo: "Académicos",
    desc: "Trámites que requieren aprobación",
    icon: <GraduationCap size={20} />,
    color: "bg-green-50 text-green-600",
    items: ["Certificado de estudios", "Sílabo por curso", "Carta de presentación"],
  },
  {
    titulo: "Becas y Convenios",
    desc: "Postula a beneficios económicos",
    icon: <Award size={20} />,
    color: "bg-yellow-50 text-yellow-600",
    items: ["Beca por excelencia", "Convenio empresarial", "Descuento familiar"],
  },
];

const TRAMITES_RECIENTES = [
  { id: 1, tipo: "Constancia de matrícula", fecha: "10 Mar 2026", estado: "aprobado" },
  { id: 2, tipo: "Certificado de estudios", fecha: "05 Mar 2026", estado: "pendiente" },
];

export default function TramitesPage() {
  return (
    <div className="p-6 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">Trámites</h1>
        <p className="text-mcm-muted text-sm mt-0.5">Solicita documentos y certificados</p>
      </div>

      {/* Categorías */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {CATEGORIAS.map((cat) => (
          <div key={cat.titulo} className="card space-y-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${cat.color}`}>{cat.icon}</div>
              <div>
                <h3 className="font-semibold text-mcm-text text-sm">{cat.titulo}</h3>
                <p className="text-xs text-mcm-muted">{cat.desc}</p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {cat.items.map((item) => (
                <li key={item}>
                  <Link href="/portal/tramites" className="flex items-center gap-2 text-sm text-mcm-text hover:text-[#C62828] transition-colors group">
                    <ArrowRight size={12} className="text-mcm-muted group-hover:text-[#C62828]" />
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Trámites recientes */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-mcm-muted" />
          <h2 className="font-semibold text-mcm-text">Mis trámites recientes</h2>
        </div>
        {TRAMITES_RECIENTES.length === 0 ? (
          <p className="text-sm text-mcm-muted text-center py-6">No tienes trámites recientes</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Tipo", "Fecha", "Estado"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TRAMITES_RECIENTES.map((t) => (
                  <tr key={t.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-mcm-text">{t.tipo}</td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">{t.fecha}</td>
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
        )}
      </div>
    </div>
  );
}
