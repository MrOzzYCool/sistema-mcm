"use client";

import { Calendar, ArrowRight } from "lucide-react";

interface Activity {
  id: string;
  title: string;
  course: string;
  dueDate: string;
  status: "pendiente" | "entregado" | "vencido";
}

const mockActivities: Activity[] = [
  { id: "1", title: "Tarea 1: Ensayo argumentativo", course: "Comunicación I", dueDate: "25/05/2026", status: "pendiente" },
  { id: "2", title: "Foro: Ética profesional", course: "Ética y Ciudadanía", dueDate: "26/05/2026", status: "pendiente" },
  { id: "3", title: "Quiz Semana 5", course: "Matemática Básica", dueDate: "27/05/2026", status: "pendiente" },
  { id: "4", title: "Informe de laboratorio", course: "Física I", dueDate: "23/05/2026", status: "vencido" },
  { id: "5", title: "Presentación grupal", course: "Metodología", dueDate: "22/05/2026", status: "entregado" },
];

const statusColors: Record<Activity["status"], string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  entregado: "bg-green-100 text-green-800",
  vencido: "bg-red-100 text-red-800",
};

const statusLabels: Record<Activity["status"], string> = {
  pendiente: "Pendiente",
  entregado: "Entregado",
  vencido: "Vencido",
};

export default function WeeklyPanel() {
  return (
    <div className="rounded-xl overflow-hidden shadow-sm flex flex-col sticky top-6 min-h-[calc(100vh-140px)]">
      <div className="bg-[#8a2b1f] px-4 py-3 flex items-center gap-2">
        <Calendar size={18} className="text-white" />
        <h2 className="text-base font-bold text-white">Actividades semanales</h2>
      </div>
      <div className="bg-white flex-1 p-4 flex flex-col gap-3">
        {mockActivities.map((activity) => (
          <div
            key={activity.id}
            className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 line-clamp-1">{activity.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{activity.course}</p>
                <p className="text-xs text-gray-400 mt-0.5">Entrega: {activity.dueDate}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[activity.status]}`}>
                {statusLabels[activity.status]}
              </span>
            </div>
            <button className="mt-2 flex items-center gap-1 text-xs text-[#a93526] hover:underline">
              Ir a <ArrowRight size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
