"use client";

import { useEffect, useState, useCallback } from "react";
import { getAccessToken } from "@/lib/get-token";
import { ChevronLeft, ChevronRight, Calendar, ClipboardList } from "lucide-react";

interface ClassEvent {
  id: string;
  curso: string;
  course_id?: string;
  dia: string;
  dia_numero: number;
  hora_inicio: string;
  hora_fin: string;
  aula: string | null;
  url_clase: string | null;
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
const HORAS_START = 7; // 7 AM
const HORAS_END = 22; // 10 PM
const HOUR_HEIGHT = 60; // px per hour

function getWeekDates(offset: number) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7);
  return DIAS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}

function formatHour(h: number): string {
  const period = h >= 12 ? "p. m." : "a. m.";
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour12.toString().padStart(2, "0")} ${period}`;
}

export default function CalendarioAVPage() {
  const [horarios, setHorarios] = useState<ClassEvent[]>([]);
  const [tareas, setTareas] = useState<TareaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);

  const weekDates = getWeekDates(weekOffset);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[5];

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) { setLoading(false); return; }

      try {
        const horRes = await fetch("/api/portal/mi-horario", { headers: { Authorization: `Bearer ${token}` } });
        if (horRes.ok) {
          const data = await horRes.json();
          setHorarios(data.horario ?? []);
        }
      } catch { /* ignore */ }

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
            } catch { /* ignore */ }
          }
          setTareas(allTareas);
        }
      } catch { /* ignore */ }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Current time position
  const now = currentTime;
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowDayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon
  const isThisWeek = weekOffset === 0;
  const nowTop = (nowHour - HORAS_START) * HOUR_HEIGHT;

  // Get tareas for a specific day
  function getTareasForDay(date: Date) {
    return tareas.filter(t => {
      const f = new Date(t.fecha_limite);
      return f.toDateString() === date.toDateString();
    });
  }

  const monthLabel = weekStart.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  const weekLabel = `Del ${weekStart.getDate()} al ${weekEnd.getDate()} de ${weekStart.toLocaleDateString("es-PE", { month: "long" })}`;

  return (
    <div className="py-4 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-500">2026 - Aula Virtual</p>
          <h1 className="text-lg font-bold text-gray-800">Semana actual — {weekLabel}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(0)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">Hoy</button>
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-[#C62828]"><ChevronLeft size={18} /></button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-[#C62828]"><ChevronRight size={18} /></button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando calendario...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Day headers */}
          <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: "60px repeat(6, 1fr)" }}>
            <div className="border-r border-gray-100" />
            {DIAS.map((dia, i) => {
              const date = weekDates[i];
              const isToday = isThisWeek && date.toDateString() === now.toDateString();
              return (
                <div key={dia} className={`px-2 py-3 text-center border-r border-gray-100 last:border-r-0 ${isToday ? "bg-blue-50" : ""}`}>
                  <p className="text-xs text-gray-500">{dia.slice(0, 3)}</p>
                  <p className={`text-lg font-bold ${isToday ? "w-8 h-8 rounded-full bg-[#C62828] text-white flex items-center justify-center mx-auto" : "text-gray-700"}`}>
                    {date.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="relative overflow-auto" style={{ maxHeight: "600px" }}>
            <div className="grid" style={{ gridTemplateColumns: "60px repeat(6, 1fr)", height: `${(HORAS_END - HORAS_START) * HOUR_HEIGHT}px` }}>
              {/* Hour labels */}
              <div className="relative border-r border-gray-100">
                {Array.from({ length: HORAS_END - HORAS_START }, (_, i) => (
                  <div key={i} className="absolute w-full text-right pr-2" style={{ top: `${i * HOUR_HEIGHT}px` }}>
                    <span className="text-[10px] text-gray-400 -translate-y-1/2 block">{formatHour(HORAS_START + i)}</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {DIAS.map((dia, colIdx) => {
                const dayClasses = horarios.filter(h => (h.dia_numero - 1) === colIdx);
                const dayTareas = getTareasForDay(weekDates[colIdx]);
                const isToday = isThisWeek && weekDates[colIdx].toDateString() === now.toDateString();

                return (
                  <div key={dia} className={`relative border-r border-gray-100 last:border-r-0 ${isToday ? "bg-blue-50/20" : ""}`}>
                    {/* Hour grid lines */}
                    {Array.from({ length: HORAS_END - HORAS_START }, (_, i) => (
                      <div key={i} className="absolute w-full border-t border-gray-100" style={{ top: `${i * HOUR_HEIGHT}px` }} />
                    ))}

                    {/* Class events */}
                    {dayClasses.map(cls => {
                      const start = parseTime(cls.hora_inicio);
                      const end = parseTime(cls.hora_fin);
                      const top = (start - HORAS_START) * HOUR_HEIGHT;
                      const height = (end - start) * HOUR_HEIGHT;
                      return (
                        <button key={cls.id} onClick={() => setSelectedEvent(cls)}
                          className="absolute left-1 right-1 bg-teal-500 text-white rounded-lg p-1.5 overflow-hidden shadow-sm z-10 text-left hover:bg-teal-600 transition-colors cursor-pointer"
                          style={{ top: `${top}px`, height: `${Math.max(height, 30)}px` }}>
                          <p className="text-[11px] font-semibold truncate">{cls.curso}</p>
                          <p className="text-[9px] opacity-80">{cls.hora_inicio} - {cls.hora_fin}</p>
                          <span className="inline-block mt-0.5 text-[8px] bg-teal-600 px-1 rounded">Virtual en vivo</span>
                        </button>
                      );
                    })}

                    {/* Tarea events (at fecha_limite hour) */}
                    {dayTareas.map(tarea => {
                      const fecha = new Date(tarea.fecha_limite);
                      const hour = fecha.getHours() + fecha.getMinutes() / 60;
                      const top = (hour - HORAS_START) * HOUR_HEIGHT;
                      return (
                        <div key={tarea.id} className="absolute left-1 right-1 bg-amber-100 border border-amber-300 text-amber-800 rounded-lg p-1.5 overflow-hidden z-10"
                          style={{ top: `${Math.max(top, 0)}px`, height: "40px" }}>
                          <p className="text-[10px] font-medium truncate flex items-center gap-0.5"><ClipboardList size={9} /> {tarea.titulo}</p>
                          <p className="text-[8px] text-amber-600 truncate">{tarea.curso_nombre}</p>
                        </div>
                      );
                    })}

                    {/* Current time line */}
                    {isToday && nowHour >= HORAS_START && nowHour <= HORAS_END && (
                      <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: `${nowTop}px` }}>
                        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                        <div className="flex-1 border-t-2 border-red-500 border-dashed" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-teal-500" />
              <span className="text-xs text-gray-500">Clase virtual en vivo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-200 border border-amber-300" />
              <span className="text-xs text-gray-500">Entrega de tarea</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 border-t-2 border-red-500 border-dashed" />
              <span className="text-xs text-gray-500">Hora actual</span>
            </div>
          </div>
        </div>
      )}

      {/* Event detail popup - positioned as side panel */}
      {selectedEvent && (
        <>
          <button onClick={() => setSelectedEvent(null)} className="fixed inset-0 z-40" aria-label="Cerrar" />
          <div className="fixed top-20 right-8 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-5 w-80">
            <button onClick={() => setSelectedEvent(null)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl">&times;</button>

            <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full border border-teal-200 text-teal-700 font-medium mb-3">
              Virtual en vivo
            </span>

            <h3 className="font-bold text-gray-800 text-base mb-1">{selectedEvent.curso}</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedEvent.dia}</p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-700">{selectedEvent.dia}, de {selectedEvent.hora_inicio} a {selectedEvent.hora_fin}</p>
              </div>

              {selectedEvent.url_clase ? (
                <a href={selectedEvent.url_clase} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Ingresar a clase (Teams)
                </a>
              ) : (
                <p className="text-xs text-gray-400 italic">Link de Teams no disponible aún</p>
              )}

              <a href={`/aula-virtual/cursos/${selectedEvent.course_id ?? ""}`} className="flex items-center gap-2 text-sm text-[#C62828] hover:underline">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Ir al contenido del curso
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
