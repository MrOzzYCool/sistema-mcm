"use client";

import { useEffect, useState, useCallback } from "react";
import { getAccessToken } from "@/lib/get-token";
import Link from "next/link";
import { Calendar, ArrowRight, Loader2, ClipboardList, MessageSquare, FileText } from "lucide-react";

interface Activity {
  id: string;
  titulo: string;
  tipo: string;
  curso_nombre: string;
  curso_id: string;
  fecha_limite: string;
  status: "pendiente" | "entregado" | "vencido" | "programada";
}

const statusColors: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  entregado: "bg-green-100 text-green-800 border border-green-200",
  vencido: "bg-red-100 text-red-800 border border-red-200",
  programada: "bg-blue-100 text-blue-800 border border-blue-200",
};

const statusLabels: Record<string, string> = {
  pendiente: "Por entregar",
  entregado: "Entregado",
  vencido: "Vencido",
  programada: "Programada",
};

const tipoIcons: Record<string, typeof ClipboardList> = {
  tarea: ClipboardList,
  practica: FileText,
  examen: FileText,
  participacion: MessageSquare,
};

function getTipoLabel(tipo: string): string {
  const map: Record<string, string> = { tarea: "Tarea calificada", practica: "Práctica calificada", examen: "Evaluación calificada", participacion: "Foro no calificado" };
  return map[tipo] ?? tipo;
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) + " a las " + new Date(d).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  } catch { return d; }
}

export default function WeeklyPanel() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) { setLoading(false); return; }

      // Get my courses
      const cursosRes = await fetch("/api/portal/mis-cursos-aula", { headers: { Authorization: `Bearer ${token}` } });
      if (!cursosRes.ok) { setLoading(false); return; }
      const cursosData = await cursosRes.json();
      const cursos = cursosData.cursos ?? cursosData ?? [];

      // Get my entregas
      const entregasRes = await fetch("/api/portal/entregas", { headers: { Authorization: `Bearer ${token}` } });
      const entregasData = entregasRes.ok ? await entregasRes.json() : { entregas: [] };
      const misEntregas = new Set((entregasData.entregas ?? []).map((e: any) => e.actividad_id));

      // Get actividades from all courses
      const allActivities: Activity[] = [];
      const now = new Date();

      for (const curso of cursos) {
        const cursoId = curso.id ?? curso.curso_id;
        if (!cursoId) continue;
        try {
          const res = await fetch(`/api/portal/actividades?curso_id=${cursoId}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) continue;
          const data = await res.json();
          (data.actividades ?? []).forEach((a: any) => {
            if (a.visible === false) return;
            if (a.fecha_inicio && new Date(a.fecha_inicio) > now) return;

            const fechaLimite = new Date(a.fecha_limite);
            let status: Activity["status"] = "pendiente";
            if (misEntregas.has(a.id)) status = "entregado";
            else if (fechaLimite < now) status = "vencido";

            allActivities.push({
              id: a.id,
              titulo: a.titulo,
              tipo: a.tipo,
              curso_nombre: curso.nombre_curso ?? curso.nombre ?? "",
              curso_id: cursoId,
              fecha_limite: a.fecha_limite,
              status,
            });
          });
        } catch { /* ignore */ }
      }

      // Sort: pendientes first, then by fecha_limite
      allActivities.sort((a, b) => {
        const order = { pendiente: 0, vencido: 1, programada: 2, entregado: 3 };
        const diff = (order[a.status] ?? 4) - (order[b.status] ?? 4);
        if (diff !== 0) return diff;
        return new Date(a.fecha_limite).getTime() - new Date(b.fecha_limite).getTime();
      });

      setActivities(allActivities);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  return (
    <div className="rounded-xl overflow-hidden shadow-sm flex flex-col sticky top-6 max-h-[calc(100vh-140px)]">
      <div className="bg-[#1a1a2e] px-4 py-3 flex items-center gap-2 shrink-0">
        <Calendar size={18} className="text-white" />
        <h2 className="text-sm font-bold text-white">Actividades semanales</h2>
      </div>
      <div className="bg-white flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-sm text-gray-400">No tienes actividades pendientes esta semana</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {activities.map(act => {
              const Icon = tipoIcons[act.tipo] ?? ClipboardList;
              return (
                <div key={act.id} className="p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 flex items-center gap-1 mb-0.5">
                        <Icon size={11} /> {getTipoLabel(act.tipo)}
                      </p>
                      <p className="text-sm font-semibold text-gray-800 line-clamp-1">{act.titulo}</p>
                      <p className="text-xs text-gray-500 uppercase mt-0.5">{act.curso_nombre}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Vence: {formatDate(act.fecha_limite)}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-medium ${statusColors[act.status]}`}>
                      {statusLabels[act.status]}
                    </span>
                  </div>
                  <Link href={`/aula-virtual/cursos/${act.curso_id}`} className="mt-1.5 flex items-center gap-1 text-xs text-[#C62828] hover:underline">
                    Ir a <ArrowRight size={11} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
