"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAccessToken } from "@/lib/get-token";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Calendar, RefreshCw,
  Upload, Loader2, FileText, AlertTriangle, CheckCircle2, Clock, ClipboardList,
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
  actividad_id: string;
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
  const [archivosSeleccionados, setArchivosSeleccionados] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const daysLeft = getDaysRemaining(actividad.fecha_limite);
  const isPastDue = daysLeft < 0;
  const hasEntregado = entregas.length > 0;
  const lastEntrega = entregas[0];
  const intentosUsados = entregas.length;
  const puedeEntregar = !isPastDue && intentosUsados < actividad.intentos_permitidos;

  const fetchEntregas = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) { setLoading(false); return; }
    // Fetch only MY entregas for this actividad
    const res = await fetch(`/api/portal/entregas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      // Filter only entregas for this specific actividad
      const misEntregas = (data.entregas ?? []).filter((e: Entrega) => e.actividad_id === actividad.id);
      setEntregas(misEntregas);
    }
    setLoading(false);
  }, [actividad.id]);

  useEffect(() => { fetchEntregas(); }, [fetchEntregas]);

  async function handleEntregar() {
    if (!comentario.trim() && archivosSeleccionados.length === 0) return;
    setSending(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión");

      // Upload files first if any
      const archivosSubidos: { nombre: string; url: string; tipo: string; tamano: number }[] = [];
      for (const file of archivosSeleccionados) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("curso_id", cursoId);
        formData.append("seccion", "entrega");
        const uploadRes = await fetch("/api/portal/materiales", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          archivosSubidos.push({
            nombre: file.name,
            url: uploadData.material?.url ?? "",
            tipo: file.name.split(".").pop() ?? "",
            tamano: file.size,
          });
        }
      }

      const res = await fetch("/api/portal/entregas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          actividad_id: actividad.id,
          comentario: comentario.trim() || null,
          archivos: archivosSubidos,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setComentario("");
      setArchivosSeleccionados([]);
      setShowEntrega(false);
      await fetchEntregas();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setSending(false); }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length + archivosSeleccionados.length > 8) {
      alert("Máximo 8 archivos");
      return;
    }
    setArchivosSeleccionados(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setArchivosSeleccionados(prev => prev.filter((_, i) => i !== index));
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
      {/* If showing entrega form - full page replacement */}
      {showEntrega ? (
        <>
          {/* Header - centered title */}
          <div className="px-6 py-3 border-b border-gray-200 shrink-0 flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-800">{actividad.titulo}</h1>
              <p className="text-xs text-gray-500">{getTipoLabel(actividad.tipo)} • {estadoLabel}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500">Criterio de la nota final</p>
              <p className="text-sm font-semibold text-gray-700">La nota más reciente</p>
            </div>
          </div>

          {/* Entrega content */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-3xl mx-auto px-6 py-5">
              <p className="text-sm text-gray-500 mb-4">Has utilizado {intentosUsados} de {actividad.intentos_permitidos >= 99 ? "∞" : actividad.intentos_permitidos} intento(s)</p>

              {/* Buttons */}
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setShowEntrega(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                  ← Volver a indicaciones
                </button>
              </div>

              {/* Indicaciones de la tarea (same as main view) */}
              {actividad.indicaciones && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">Indicaciones de la tarea</h2>
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {actividad.indicaciones}
                  </div>
                </div>
              )}

              {/* Fecha de entrega */}
              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-800 mb-2">Fecha de entrega de la actividad:</h3>
                <p className="text-sm text-gray-600">{formatDate(actividad.fecha_limite)}</p>
              </div>

              {/* Entrega form */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-base font-semibold text-gray-800 mb-1">Entrega tu tarea *</h3>
                <p className="text-xs text-gray-500 mb-4">Puedes entregar tu tarea mediante un texto, URL o adjuntando un archivo.</p>

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

                {/* File upload */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adjunta un archivo</label>
                  <input ref={fileInputRef} type="file" className="hidden" multiple
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.mp3,.mp4,.zip,.rar"
                    onChange={handleFileSelect} />
                  <div onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer">
                    <p className="text-sm text-gray-500 mb-1">Máximo 8 archivos</p>
                    <p className="text-xs text-blue-600 font-medium">+ Subir archivo</p>
                    <p className="text-[10px] text-gray-400 mt-2">Archivos: PDF, PPT, Word, Excel, JPG, JPEG, PNG, mp3, mp4, zip o rar</p>
                    <p className="text-[10px] text-gray-400">(Tamaño máximo por archivo: 100 MB)</p>
                  </div>
                  {archivosSeleccionados.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {archivosSeleccionados.map((file, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded text-sm">
                          <span className="text-gray-700 truncate">{file.name}</span>
                          <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 text-xs ml-2">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-red-500 mb-4">* Información necesaria para confirmar.</p>

                <div className="flex gap-3">
                  <button onClick={() => setShowEntrega(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    Cancelar entrega
                  </button>
                  <button onClick={handleEntregar} disabled={sending || (!comentario.trim() && archivosSeleccionados.length === 0)}
                    className="ml-auto px-5 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:bg-gray-400 flex items-center gap-2 hover:bg-gray-900">
                    {sending && <Loader2 size={14} className="animate-spin" />}
                    Entregar tarea
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Normal view - activity details */}
          {/* Banner de tiempo */}
          {!isPastDue && !hasEntregado && !loading && (
            <div className="bg-amber-400 text-center py-2 px-4 shrink-0">
              <p className="text-sm text-amber-900 font-medium">
                ⚠️ Te queda(n) {daysLeft} día(s) para enviar tu tarea
              </p>
            </div>
          )}
          {isPastDue && !hasEntregado && !loading && (
            <div className="bg-red-500 text-center py-2 px-4 shrink-0">
              <p className="text-sm text-white font-medium">La fecha límite ha pasado</p>
            </div>
          )}

          {/* Header with nota */}
          <div className="px-6 py-3 border-b border-gray-200 shrink-0 flex items-center justify-between">
            <div className="flex-1 text-center">
              <h1 className="text-lg font-bold text-gray-800">{actividad.titulo}</h1>
              <div className="flex items-center gap-2 mt-0.5 justify-center">
                <span className="text-xs text-gray-500">{getTipoLabel(actividad.tipo)}</span>
                <span className="text-gray-300">•</span>
                <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${estadoColor}`}>
                  {estadoLabel}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0 flex items-center gap-3">
              {lastEntrega?.estado === "calificado" ? (
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">Estado</p>
                  <p className="text-xs text-green-600 font-semibold">Calificado</p>
                  <p className="text-2xl font-bold text-green-700">{lastEntrega.nota}<span className="text-sm text-gray-400">/{actividad.nota_maxima}</span></p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">Estado</p>
                  <p className="text-sm font-semibold text-[#C62828]">Por calificar</p>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-3xl mx-auto px-6 py-5">
              {/* Info + buttons */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">Has utilizado {intentosUsados} de {actividad.intentos_permitidos >= 99 ? "∞" : actividad.intentos_permitidos} intento(s)</p>
                {!loading && puedeEntregar && (
                  <button onClick={() => setShowEntrega(true)}
                    className="px-4 py-2 border border-blue-600 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50">
                    Ir a entregar tarea
                  </button>
                )}
              </div>

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

              {/* Feedback del profesor */}
              {lastEntrega?.feedback_profesor && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm font-medium text-blue-800 mb-1">Retroalimentación del docente:</p>
                  <p className="text-sm text-blue-700">{lastEntrega.feedback_profesor}</p>
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
        </>
      )}
    </div>
  );
}
