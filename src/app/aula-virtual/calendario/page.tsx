"use client";

import { useEffect, useState, useCallback } from "react";
import { getAccessToken } from "@/lib/get-token";
import { ChevronLeft, ChevronRight, Calendar, Clock, ClipboardList } from "lucide-react";

interface ClassEvent {
  id: string;
  curso_nombre: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string | null;
  profesor: string | null;
}

interface TareaEvent {
  id: string;
  titulo: string;
  tipo: string;
  curso_nombre?: string;
  fecha_limite: string;
  semana: number;
}

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const HORAS = Array.from({ length: 14 }, (_, i) => `${(i + 7).toString().padStart(2, "0")}:00`);

function getDayIndex(dia: string): number {
  const map: Record<string, number> = { lunes: 0, martes: 1, miercoles: 2, miércoles: 2, jueves: 3, viernes: 4, sabado: 5, sábado: 5 };
  return map[dia.toLowerCase()] ?? -1;
}

function getWeekDates(offset: number) {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7);
  return DIAS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function CalendarioAVPage() {
  const [horarios, setHorarios] = useState<ClassEvent[]>([]);
  const [tareas, setTareas] = useState<TareaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDates = getWeekDates(weekOffset);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[5];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) { setLoading(false); return; }

      // Fetch horarios
      try {
        const horRes = await fetch("/api/portal/mi-horario", { headers: { Authorization: `Bearer ${token}` } });
        if (horRes.ok) {
          const data = await horRes.json();
          setHorarios(data.horarios ?? data ?? []);
        }
      } catch { /* ignore */ }

      // Fetch actividades/tareas
      try {
        const actRes = await fetch("/api/portal/mis-cursos-aula", { headers: { Authorization: `Bearer ${token}` } });
        if (actRes.ok) {
          const cursosData = await actRes.json();
          const cursos = cursosData.cursos ?? cursosData ?? [];
          
          const allTareas: TareaEvent[] = [];
          for (const curso of cursos) {
            const cursoId = curso.id ?? curso.curso_id;
            if (!cursoId) continue;
            try {
              const res = await fetch(`/api/portal/actividades?curso_id=${cursoId}`, { headers: { Authorization: `Bearer ${token}` } });
              if (res.ok) {
                const actData = await res.json();
                (actData.actividades ?? []).forEach((a: any) => {
                  if (a.visible !== false && a.fecha_limite) {
                    allTareas.push({ id: a.id, titulo: a.titulo, tipo: a.tipo, curso_nombre: curso.nombre_curso ?? curso.nombre, fecha_limite: a.fecha_limite, semana: a.semana });
                  }
                });
              }
            } catch { /* ignore individual course errors */ }
          }
          setTareas(allTareas);
        }
      } catch { /* ignore */ }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Get tareas for the current week
  const tareasThisWeek = tareas.filter(t => {
    const fecha = new Date(t.fecha_limite);
    return fecha >= weekStart && fecha <= new Date(weekEnd.getTime() + 86400000);
  });

  // Group tareas by day
  function getTareasForDay(date: Date) {
    return tareasThisWeek.filter(t => {
      const f = new Date(t.fecha_limite);
      return f.toDateString() === date.toDateString();
    });
  }

  const monthLabel = weekStart.toLocaleDateString("es-PE", { month: "long", year: "numeric" });

  return (
    <div className="py-4 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Calendar size={22} className="text-[#C62828]" /> Mi Calendario</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={18} /></button>
          <button onClick={() => setWeekOffset(0)} className="px-3 py-1.5 text-xs bg-[#C62828] text-white rounded-lg">Hoy</button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={18} /></button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando calendario...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Week header */}
          <div className="grid grid-cols-6 border-b border-gray-200">
            {DIAS.map((dia, i) => {
              const date = weekDates[i];
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div key={dia} className={`px-2 py-3 text-center border-r border-gray-100 last:border-r-0 ${isToday ? "bg-red-50" : ""}`}>
                  <p className="text-xs text-gray-500">{dia}</p>
                  <p className={`text-lg font-bold ${isToday ? "text-[#C62828]" : "text-gray-700"}`}>{date.getDate()}</p>
                </div>
              );
            })}
          </div>

          {/* Schedule grid */}
          <div className="grid grid-cols-6 min-h-[400px]">
            {DIAS.map((dia, colIdx) => {
              const dayClasses = horarios.filter(h => getDayIndex(h.dia_semana) === colIdx);
              const dayTareas = getTareasForDay(weekDates[colIdx]);
              const isToday = weekDates[colIdx].toDateString() === new Date().toDateString();

              return (
                <div key={dia} className={`border-r border-gray-100 last:border-r-0 p-2 space-y-2 ${isToday ? "bg-red-50/30" : ""}`}>
                  {/* Classes */}
                  {dayClasses.map(cls => (
                    <div key={cls.id} className="bg-[#C62828] text-white rounded-lg p-2 text-xs">
                      <p className="font-medium truncate">{cls.curso_nombre}</p>
                      <p className="opacity-80 flex items-center gap-1 mt-0.5"><Clock size={10} /> {cls.hora_inicio} - {cls.hora_fin}</p>
                      {cls.profesor && <p className="opacity-70 truncate mt-0.5">{cls.profesor}</p>}
                    </div>
                  ))}
                  {/* Tareas */}
                  {dayTareas.map(tarea => (
                    <div key={tarea.id} className="bg-amber-100 border border-amber-200 rounded-lg p-2 text-xs">
                      <p className="font-medium text-amber-800 truncate flex items-center gap-1">
                        <ClipboardList size={10} /> {tarea.titulo}
                      </p>
                      <p className="text-amber-600 truncate mt-0.5">{tarea.curso_nombre}</p>
                      <p className="text-amber-500 text-[10px] mt-0.5">
                        Límite: {new Date(tarea.fecha_limite).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  ))}
                  {dayClasses.length === 0 && dayTareas.length === 0 && (
                    <p className="text-[10px] text-gray-300 text-center pt-4">—</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-[#C62828]" />
              <span className="text-xs text-gray-500">Clase programada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-200 border border-amber-300" />
              <span className="text-xs text-gray-500">Tarea/Actividad pendiente</span>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming tasks list */}
      {tareasThisWeek.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><ClipboardList size={16} className="text-amber-500" /> Entregas esta semana</h2>
          <div className="space-y-2">
            {tareasThisWeek.sort((a, b) => new Date(a.fecha_limite).getTime() - new Date(b.fecha_limite).getTime()).map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-50 border border-amber-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">{t.titulo}</p>
                  <p className="text-xs text-gray-500">{t.curso_nombre}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-amber-700 font-medium">{new Date(t.fecha_limite).toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" })}</p>
                  <p className="text-[10px] text-amber-500">{new Date(t.fecha_limite).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
