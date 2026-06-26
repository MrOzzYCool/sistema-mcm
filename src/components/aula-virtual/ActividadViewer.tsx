"use client";

import { useState, useEffect, useCallback } from "react";
import { getAccessToken } from "@/lib/get-token";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Calendar, RefreshCw,
  Upload, Loader2, FileText, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";

interface Actividad {
  id: string;
  titulo: string;
  tipo: string;
  indicaciones: string | null;
  fecha_inicio: string | null;
  fecha_limite: string;
  intentos_permitidos: number;
  nota_maxima: number;
  rubrica: string | null;
  tipos_entrega: string[];
}

interface Entrega {
  id: string;
  intento: number;
  comentario: string | null;
  archivos: { nombre: string; url: string; tipo: string; tamano: number }[];
  estado: string;
  nota: number | null;
  feedback_profesor: string | null;
  entregado_at: string;
}

interface ActividadViewerProps {
  actividad: Actividad;
  cursoId: string;
  onClose: () => void;
  totalItems: number;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return d; }
}

function getDaysRemaining(fecha: string): number {
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getTipoLabel(tipo: string): string {
  const map: Record<string, string> = { tarea: "Tarea calificada", practica: "Práctica calificada", examen: "Examen", participacion: "Participación en clase" };
  return map[tipo] ?? tipo;
}

export default function ActividadViewer({
  actividad, cursoId, onClose, totalItems, currentIndex, onPrev, onNext, canGoPrev, canGoNext,
}: ActividadViewerProps) {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEntrega, setShowEntrega] = useState(false);
  const [comentario, setComentario] = useState("");
  const [sending, setSending] = useState(false);

  const daysLeft = getDaysRemaining(actividad.fecha_limite);
  const isPastDue = daysLeft < 0;
  const hasEntregado = entregas.length > 0;
  const lastEntrega = entregas[0];
  const intentosUsados = entregas.length;
  const puedeEntregar = !isPastDue && intentosUsados < actividad.intentos_permitidos;

  const fetchEntregas = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/portal/entregas?actividad_id=${actividad.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setEntregas(data.entregas ?? []);
    }
    setLoading(false);
  }, [actividad.id]);

  useEffect(() => { fetchEntregas(); }, [fetchEntregas]);

  async function handleEntregar() {
    if (!comentario.trim()) return;
    setSending(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión");
      const res = await fetch("/api/portal/entregas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ actividad_id: actividad.id, comentario: comentario.trim(), archivos: [] }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setComentario("");
      setShowEntrega(false);
      await fetchEntregas();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setSending(false); }
  }

  // Estado badge
  const estadoLabel = hasEntregado
    ? lastEntrega.estado === "calificado" ? "Calificado" : "Entregado"
    : isPastDue ? "Vencido" : "Por entregar";
  const estadoColor = hasEntregado
    ? lastEntrega.estado === "calificado" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
    : isPastDue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";

  return (
    <div className="flex flex-col h-full">
      {/* Banner de tiempo */}
      {!isPastDue && !hasEntregado && (
        <div className="bg-amber-400 text-center py-2 px-4 shrink-0">
          <p className="text-sm text-amber-900 font-medium">
            ⚠️ Te queda(n) {daysLeft} día(s) para enviar tu tarea
          </p>
        </div>
      )}
      {isPastDue && !hasEntregado && (
        <div className="bg-red-500 text-center py-2 px-4 shrink-0">
          <p className="text-sm text-white font-medium">La fecha límite ha pasado</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-5">
          {/* Title + badge */}
          <h1 className="text-xl font-bold text-gray-800 mb-1">{actividad.titulo}</h1>
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-sm text-gray-500">{getTipoLabel(actividad.tipo)}</span>
            <span className="text-gray-300">•</span>
            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${estadoColor}`}>
              {estadoLabel}
            </span>
            {puedeEntregar && (
              <button onClick={() => setShowEntrega(true)}
                className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                Entregar tarea
              </button>
            )}
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg">
              <Calendar size={18} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Fecha límite</p>
                <p className="text-xs text-gray-500">{formatDate(actividad.fecha_limite)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg">
              <RefreshCw size={18} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Intentos permitidos</p>
                <p className="text-xs text-gray-500">
                  {actividad.intentos_permitidos >= 99 ? "Ilimitado" : `${intentosUsados} de ${actividad.intentos_permitidos} usados`}
                </p>
              </div>
            </div>
          </div>

          {/* Calificación si ya calificado */}
          {lastEntrega?.estado === "calificado" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={18} className="text-green-600" />
                <span className="text-sm font-semibold text-green-800">Nota: {lastEntrega.nota}/{actividad.nota_maxima}</span>
              </div>
              {lastEntrega.feedback_profesor && (
                <p className="text-sm text-green-700">{lastEntrega.feedback_profesor}</p>
              )}
            </div>
          )}

          {/* Indicaciones */}
          {actividad.indicaciones && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Indicaciones de la tarea</h2>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {actividad.indicaciones}
              </div>
            </div>
          )}

          {/* Info adicional */}
          <div className="border-t border-gray-200 pt-6 mb-6">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Información adicional</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2"><Upload size={14} /> Tipos de archivo: {actividad.tipos_entrega.map(t => t.toUpperCase()).join(", ")}</p>
              <p className="flex items-center gap-2"><FileText size={14} /> Tamaño máximo: 100 MB por archivo</p>
            </div>
          </div>

          {/* Zona de entrega */}
          {showEntrega && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-base font-semibold text-gray-800 mb-3">Entrega tu tarea</h3>
              <p className="text-xs text-gray-500 mb-3">Puedes entregar tu tarea mediante un texto, URL o adjuntando un archivo.</p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Escribe un comentario o pega el URL de tu tarea</label>
                <textarea
                  value={comentario}
                  onChange={e => setComentario(e.target.value)}
                  placeholder="Escribe un texto..."
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowEntrega(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">
                  Cancelar entrega
                </button>
                <button onClick={handleEntregar} disabled={sending || !comentario.trim()}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                  {sending && <Loader2 size={14} className="animate-spin" />}
                  Entregar tarea
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-gray-200 shrink-0 bg-white">
        <div className="flex items-center justify-between px-6 py-3">
          <button onClick={onPrev} disabled={!canGoPrev}
            className="inline-flex items-center gap-1 text-sm font-medium text-[#C62828] hover:underline disabled:text-gray-300 disabled:cursor-not-allowed">
            <ChevronLeft size={16} /> Anterior
          </button>
          <button onClick={onNext} disabled={!canGoNext}
            className="inline-flex items-center gap-1 text-sm font-medium text-[#C62828] hover:underline disabled:text-gray-300 disabled:cursor-not-allowed">
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
