"use client";

import { useEffect, useState, useCallback } from "react";
import { getAccessToken } from "@/lib/get-token";
import { useAuth } from "@/lib/auth-context";
import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react";

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

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const HORAS_START = 7;
const HORAS_END = 22;
const HOUR_HEIGHT = 60;

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

export default function CalendarioDocentePage() {
  const { user } = useAuth();
  const [horarios, setHorarios] = useState<ClassEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });

  const weekDates = getWeekDates(weekOffset);
  const isThisWeek = weekOffset === 0;
  const now = currentTime;
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowTop = (nowHour - HORAS_START) * HOUR_HEIGHT;

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) { setLoading(false); return; }
      // Use the cursos-docente API which returns class_schedules for this professor
      const res = await fetch("/api/portal/cursos-docente", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const cursos = data.cursos ?? data ?? [];
        // Each curso has schedule info
        const DAY_NAMES: Record<number, string> = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado" };
        const events: ClassEvent[] = [];
        for (const curso of cursos) {
          if (curso.dia_semana && curso.hora_inicio) {
            events.push({
              id: curso.schedule_id ?? curso.id,
              curso: curso.nombre_curso ?? curso.nombre ?? "",
              course_id: curso.curso_id ?? curso.id,
              dia: DAY_NAMES[curso.dia_semana] ?? `Día ${curso.dia_semana}`,
              dia_numero: curso.dia_semana,
              hora_inicio: curso.hora_inicio?.slice(0, 5) ?? "18:00",
              hora_fin: curso.hora_fin?.slice(0, 5) ?? "20:00",
              aula: curso.aula ?? null,
              url_clase: curso.url_clase ?? null,
            });
          }
        }
        setHorarios(events);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const weekLabel = `Del ${weekDates[0].getDate()} al ${weekDates[5].getDate()} de ${weekDates[0].toLocaleDateString("es-PE", { month: "long" })}`;

  return (
    <div className="py-4 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Calendar size={20} className="text-[#C62828]" /> Mi Calendario</h1>
          <p className="text-sm text-gray-500 mt-0.5">{weekLabel}</p>
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
                  <p className={`text-lg font-bold ${isToday ? "w-8 h-8 rounded-full bg-[#C62828] text-white flex items-center justify-center mx-auto" : "text-gray-700"}`}>{date.getDate()}</p>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="relative overflow-auto" style={{ maxHeight: "550px" }}>
            <div className="grid" style={{ gridTemplateColumns: "60px repeat(6, 1fr)", height: `${(HORAS_END - HORAS_START) * HOUR_HEIGHT}px` }}>
              <div className="relative border-r border-gray-100">
                {Array.from({ length: HORAS_END - HORAS_START }, (_, i) => (
                  <div key={i} className="absolute w-full text-right pr-2" style={{ top: `${i * HOUR_HEIGHT}px` }}>
                    <span className="text-[10px] text-gray-400 -translate-y-1/2 block">{formatHour(HORAS_START + i)}</span>
                  </div>
                ))}
              </div>
              {DIAS.map((dia, colIdx) => {
                const dayClasses = horarios.filter(h => (h.dia_numero - 1) === colIdx);
                const isToday = isThisWeek && weekDates[colIdx].toDateString() === now.toDateString();
                return (
                  <div key={dia} className={`relative border-r border-gray-100 last:border-r-0 ${isToday ? "bg-blue-50/20" : ""}`}>
                    {Array.from({ length: HORAS_END - HORAS_START }, (_, i) => (
                      <div key={i} className="absolute w-full border-t border-gray-100" style={{ top: `${i * HOUR_HEIGHT}px` }} />
                    ))}
                    {dayClasses.map(cls => {
                      const start = parseTime(cls.hora_inicio);
                      const end = parseTime(cls.hora_fin);
                      const top = (start - HORAS_START) * HOUR_HEIGHT;
                      const height = (end - start) * HOUR_HEIGHT;
                      return (
                        <button key={cls.id} onClick={(e) => { const rect = (e.currentTarget).getBoundingClientRect(); setPopupPos({ x: rect.right + 8, y: rect.top }); setSelectedEvent(cls); }}
                          className="absolute left-1 right-1 bg-[#C62828] text-white rounded-lg p-1.5 overflow-hidden shadow-sm z-10 text-left hover:bg-[#A31F1F] transition-colors cursor-pointer"
                          style={{ top: `${top}px`, height: `${Math.max(height, 30)}px` }}>
                          <p className="text-[11px] font-semibold truncate">{cls.curso}</p>
                          <p className="text-[9px] opacity-80">{cls.hora_inicio} - {cls.hora_fin}</p>
                        </button>
                      );
                    })}
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
        </div>
      )}

      {/* Popup */}
      {selectedEvent && (
        <>
          <button onClick={() => setSelectedEvent(null)} className="fixed inset-0 z-40" />
          <div className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-5 w-72"
            style={{ top: `${Math.min(popupPos.y, (typeof window !== "undefined" ? window.innerHeight : 600) - 250)}px`, left: `${Math.min(popupPos.x, (typeof window !== "undefined" ? window.innerWidth : 800) - 300)}px` }}>
            <button onClick={() => setSelectedEvent(null)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full border border-teal-200 text-teal-700 font-medium mb-3">Virtual en vivo</span>
            <h3 className="font-bold text-gray-800 text-base mb-1">{selectedEvent.curso}</h3>
            <p className="text-sm text-gray-500 mb-3">{selectedEvent.dia}</p>
            <div className="flex items-start gap-3 mb-2">
              <Calendar size={14} className="text-gray-400 mt-0.5" />
              <p className="text-sm text-gray-700">{selectedEvent.hora_inicio} - {selectedEvent.hora_fin}</p>
            </div>
            {selectedEvent.url_clase ? (
              <a href={selectedEvent.url_clase} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                Abrir clase (Teams)
              </a>
            ) : (
              <p className="text-xs text-gray-400 italic">Link Teams no disponible</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
