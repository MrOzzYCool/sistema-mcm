"use client";

import { useState, useEffect, useRef } from "react";
import { getAccessToken } from "@/lib/get-token";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, X, Video, MapPin } from "lucide-react";

interface ClaseHorario {
  id: string;
  dia: string;
  dia_numero: number;
  curso: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string | null;
  url_clase: string | null;
}

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HORAS = Array.from({ length: 16 }, (_, i) => i + 7); // 7:00 a 22:00

const COLORES_CURSO = [
  { bg: "bg-rose-100", border: "border-rose-300", text: "text-rose-800", dot: "bg-rose-500" },
  { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-800", dot: "bg-emerald-500" },
  { bg: "bg-violet-100", border: "border-violet-300", text: "text-violet-800", dot: "bg-violet-500" },
  { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-800", dot: "bg-amber-500" },
  { bg: "bg-sky-100", border: "border-sky-300", text: "text-sky-800", dot: "bg-sky-500" },
  { bg: "bg-pink-100", border: "border-pink-300", text: "text-pink-800", dot: "bg-pink-500" },
  { bg: "bg-teal-100", border: "border-teal-300", text: "text-teal-800", dot: "bg-teal-500" },
  { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800", dot: "bg-orange-500" },
];

function getWeekDates(baseDate: Date): Date[] {
  const d = new Date(baseDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(d);
    date.setDate(d.getDate() + i);
    return date;
  });
}

function getWeekNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("es-PE", { day: "numeric", month: "short" }).replace(".", "");
}

function timeToRow(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h - 7) * 60 + (m || 0); // minutes from 7:00
}

export default function CalendarioPage() {
  const [horario, setHorario] = useState<ClaseHorario[]>([]);
  const [carrera, setCarrera] = useState<string | null>(null);
  const [ciclo, setCiclo] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedClase, setSelectedClase] = useState<ClaseHorario | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    async function fetchHorario() {
      try {
        const token = await getAccessToken();
        if (!mountedRef.current || !token) return;
        const res = await fetch("/api/portal/mi-horario", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!mountedRef.current) return;
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Error al cargar horario");
        }
        const data = await res.json();
        if (!mountedRef.current) return;
        setHorario(data.horario ?? []);
        setCarrera(data.carrera ?? null);
        setCiclo(data.ciclo ?? null);
        setMessage(data.message ?? null);
      } catch (err) {
        if (mountedRef.current) setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }
    fetchHorario();
    return () => { mountedRef.current = false; };
  }, []);

  const weekDates = getWeekDates(currentWeek);
  const weekNum = getWeekNumber(currentWeek);
  const today = new Date();

  // Color mapping
  const cursoNombres = [...new Set(horario.map((h) => h.curso))];
  const colorMap = new Map(cursoNombres.map((c, i) => [c, COLORES_CURSO[i % COLORES_CURSO.length]]));

  function goToday() { setCurrentWeek(new Date()); }
  function goPrev() { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); }
  function goNext() { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh] gap-3 text-mcm-muted">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Cargando horario...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-red-600 font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 w-full space-y-3">
      {/* Header + Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-mcm-text">Mi Horario</h1>
          {carrera && ciclo && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-[#8a2b1f] font-medium border border-red-200">{carrera}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium border border-green-200">Ciclo {ciclo}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="p-1.5 rounded-lg border border-mcm-border hover:bg-red-50 hover:border-[#a93526]/30 transition">
            <ChevronLeft size={16} className="text-[#8a2b1f]" />
          </button>
          <button onClick={goToday} className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#a93526] text-white hover:bg-[#8a2b1f] transition">
            Hoy
          </button>
          <button onClick={goNext} className="p-1.5 rounded-lg border border-mcm-border hover:bg-red-50 hover:border-[#a93526]/30 transition">
            <ChevronRight size={16} className="text-[#8a2b1f]" />
          </button>
          <span className="text-xs text-mcm-muted ml-2">
            Sem {weekNum}: {formatShortDate(weekDates[0])} - {formatShortDate(weekDates[6])}
          </span>
        </div>
      </div>

      {/* Course legend bar */}
      {cursoNombres.length > 0 && (
        <div className="flex flex-wrap gap-2 py-2">
          {cursoNombres.map((curso) => {
            const color = colorMap.get(curso)!;
            return (
              <span key={curso} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-mcm-text">
                <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                {curso}
              </span>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {horario.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-mcm-muted text-sm">
            {message ?? "No se encontraron horarios programados para tu ciclo actual."}
          </p>
        </div>
      ) : (
        /* Weekly calendar grid */
        <div className="bg-white rounded-xl border border-mcm-border overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b border-mcm-border bg-slate-50">
            <div className="p-2" />
            {weekDates.map((date, i) => {
              const isToday = date.toDateString() === today.toDateString();
              return (
                <div key={i} className="p-2 text-center border-l border-mcm-border">
                  <p className="text-[10px] text-mcm-muted uppercase font-medium">{DIAS_CORTOS[i]}</p>
                  <p className={`text-sm font-bold mt-0.5 ${isToday
                    ? "w-7 h-7 rounded-full bg-[#a93526] text-white flex items-center justify-center mx-auto"
                    : "text-mcm-text"}`}>
                    {date.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-[50px_repeat(7,1fr)] relative" style={{ height: `${HORAS.length * 60}px` }}>
            {/* Hour labels */}
            {HORAS.map((hour) => (
              <div key={hour} className="absolute left-0 w-[50px] text-right pr-2" style={{ top: `${(hour - 7) * 60}px` }}>
                <span className="text-[10px] text-mcm-muted font-mono">{String(hour).padStart(2, "0")}:00</span>
              </div>
            ))}

            {/* Hour grid lines */}
            {HORAS.map((hour) => (
              <div key={`line-${hour}`} className="absolute left-[50px] right-0 border-t border-mcm-border/50"
                style={{ top: `${(hour - 7) * 60}px` }} />
            ))}

            {/* Day columns */}
            {weekDates.map((_, i) => (
              <div key={`col-${i}`} className="absolute border-l border-mcm-border/50"
                style={{ left: `calc(50px + ${(i) * (100 / 7)}% * 7 / 7)`, top: 0, bottom: 0, width: 0 }} />
            ))}

            {/* Class blocks */}
            {horario.map((clase) => {
              const dayIndex = clase.dia_numero - 1; // 0-indexed (Lunes=0)
              if (dayIndex < 0 || dayIndex > 6) return null;

              const topPx = timeToRow(clase.hora_inicio);
              const bottomPx = timeToRow(clase.hora_fin);
              const height = bottomPx - topPx;
              const color = colorMap.get(clase.curso) ?? COLORES_CURSO[0];

              const colWidth = `calc((100% - 50px) / 7)`;
              const leftOffset = `calc(50px + ${dayIndex} * ${colWidth})`;

              return (
                <div
                  key={clase.id}
                  className={`absolute rounded-md border px-1.5 py-1 cursor-pointer hover:shadow-md transition-shadow overflow-hidden ${color.bg} ${color.border} ${color.text}`}
                  style={{
                    top: `${topPx}px`,
                    height: `${Math.max(height, 30)}px`,
                    left: leftOffset,
                    width: colWidth,
                    marginLeft: "2px",
                    marginRight: "2px",
                  }}
                  onClick={() => setSelectedClase(clase)}
                >
                  <p className="text-[10px] font-bold leading-tight truncate">{clase.curso}</p>
                  <p className="text-[9px] opacity-75">{clase.hora_inicio}-{clase.hora_fin}</p>
                  {clase.aula && <p className="text-[9px] opacity-60 truncate">{clase.aula}</p>}
                  {clase.url_clase && <Video size={10} className="mt-0.5 opacity-60" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail popup/modal */}
      {selectedClase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelectedClase(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">{selectedClase.curso}</h3>
              <button onClick={() => setSelectedClase(null)} className="text-mcm-muted hover:text-[#a93526]">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-mcm-text">
                <span className="font-medium w-20 shrink-0">Día:</span>
                <span>{selectedClase.dia}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-mcm-text">
                <span className="font-medium w-20 shrink-0">Hora:</span>
                <span>{selectedClase.hora_inicio} - {selectedClase.hora_fin}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-mcm-text">
                <span className="font-medium w-20 shrink-0">Aula:</span>
                <span>{selectedClase.aula ?? "No asignada"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-mcm-text">
                <span className="font-medium w-20 shrink-0">Modalidad:</span>
                <span className="flex items-center gap-1">
                  {selectedClase.url_clase ? (
                    <><Video size={14} className="text-[#a93526]" /> Virtual</>
                  ) : (
                    <><MapPin size={14} className="text-[#a93526]" /> Presencial</>
                  )}
                </span>
              </div>
              {selectedClase.url_clase ? (
                <a href={selectedClase.url_clase} target="_blank" rel="noopener noreferrer"
                  className="block w-full text-center py-2.5 rounded-xl bg-[#a93526] text-white text-sm font-semibold hover:bg-[#8a2b1f] transition mt-4">
                  Unirse a la clase
                </a>
              ) : selectedClase.aula ? null : (
                <p className="text-xs text-mcm-muted text-center mt-3 italic">Link no disponible aún</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
