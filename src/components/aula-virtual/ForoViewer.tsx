"use client";

import { useState, useEffect, useCallback } from "react";
import { getAccessToken } from "@/lib/get-token";
import {
  ArrowLeft, ChevronLeft, ChevronRight, MessageSquare, Send,
  Calendar, Loader2, User as UserIcon,
} from "lucide-react";

interface ForoComment {
  id: string;
  user_id: string;
  user_name: string;
  user_rol: string;
  mensaje: string;
  created_at: string;
  parent_id: string | null;
  replies?: ForoComment[];
}

interface ForoViewerProps {
  /** Semana del foro */
  semana: number;
  /** ID del curso */
  cursoId: string;
  /** Callback para cerrar el visor */
  onClose: () => void;
  /** Navegación: total de ítems en la semana y posición actual */
  totalItems: number;
  currentIndex: number;
  /** Navegar al anterior/siguiente ítem de la semana */
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

function formatCommentDate(d: string): string {
  try {
    const date = new Date(d);
    return `Comentado el ${date.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })} a las ${date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`;
  } catch { return d; }
}

function formatForoDate(d: string | null): string {
  if (!d) return "Sin fecha";
  try {
    return new Date(d).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return d; }
}

export default function ForoViewer({
  semana,
  cursoId,
  onClose,
  totalItems,
  currentIndex,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
}: ForoViewerProps) {
  const [comments, setComments] = useState<ForoComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const fetchComments = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/portal/foros?curso_id=${cursoId}&semana=${semana}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments ?? []);
      }
    } catch (err) {
      console.error("Error fetching foro comments:", err);
    }
    setLoading(false);
  }, [cursoId, semana]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleSend() {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión");
      const res = await fetch("/api/portal/foros", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ curso_id: cursoId, semana, mensaje: newMessage.trim() }),
      });
      if (res.ok) {
        setNewMessage("");
        await fetchComments();
      }
    } catch (err) {
      alert("Error al enviar comentario");
    }
    setSending(false);
  }

  // Keyboard: Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-[#C62828] hover:underline">
          <ArrowLeft size={16} /> Volver al contenido
        </button>
        <span className="text-xs text-gray-400">{currentIndex + 1} de {totalItems}</span>
      </div>

      {/* Banner amarillo */}
      <div className="bg-amber-400 text-center py-2 px-4 shrink-0">
        <p className="text-sm text-amber-900 font-medium">
          ⚠️ El docente aún no califica tu actividad, te notificaremos cuando sea calificada.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Foro de Consulta - Semana {semana}</h1>
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm text-gray-500">Foro no calificado</span>
            <span className="text-gray-300">&bull;</span>
            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
              Activo
            </span>
          </div>

          {/* Info section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Información</h2>
            <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-3">
              <Calendar size={18} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Fecha disponible</p>
                <p className="text-xs text-gray-500">Disponible durante toda la semana</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Descripción</h2>
            <div className="text-sm text-gray-600 space-y-3">
              <p>¡Hola!</p>
              <p>En este espacio puedes poner las dudas que tengas acerca de los diferentes temas de la semana, así como, sobre alguna tarea o actividad que no te quede clara. ¡Te responderé lo más pronto posible!</p>
              <p>Recuerda que este es un espacio colaborativo, revisa siempre las preguntas de tus demás compañeros, es posible que hayan tenido las mismas dudas que tú y ya las hayan planteado con anterioridad. Además, si tú consideras que puedes colaborar con alguna pregunta de tu compañero, ¡puedes responder también!</p>
            </div>
          </div>

          {/* Comments section */}
          <div className="border-t border-gray-200 pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-4">
                {comments.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Aún no hay comentarios. ¡Sé el primero en preguntar!</p>
                )}
                {comments.map(comment => (
                  <CommentCard key={comment.id} comment={comment} />
                ))}
              </div>
            )}

            {/* New comment input */}
            <div className="mt-6 flex gap-3 items-start">
              <div className="w-10 h-10 rounded-full bg-[#C62828] flex items-center justify-center shrink-0">
                <UserIcon size={18} className="text-white" />
              </div>
              <div className="flex-1">
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Escribe tu consulta aquí..."
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#C62828]/20 focus:border-[#C62828]"
                  rows={3}
                  onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleSend(); }}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || sending}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#C62828] text-white rounded-lg text-sm font-medium hover:bg-[#A31F1F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Enviar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-gray-200 shrink-0 bg-white">
        <div className="flex items-center justify-between px-6 py-3">
          <button
            onClick={onPrev}
            disabled={!canGoPrev}
            className="inline-flex items-center gap-1 text-sm font-medium text-[#C62828] hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} /> Anterior
          </button>
          <button
            onClick={onNext}
            disabled={!canGoNext}
            className="inline-flex items-center gap-1 text-sm font-medium text-[#C62828] hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
          >
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentCard({ comment }: { comment: ForoComment }) {
  const isDocente = comment.user_rol === "profesor" || comment.user_rol === "super_admin";

  return (
    <div className={`rounded-lg p-4 ${isDocente ? "bg-purple-50 border-l-4 border-purple-300" : "bg-gray-50"}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isDocente ? "bg-teal-500" : "bg-cyan-500"}`}>
          <UserIcon size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-800 uppercase">{comment.user_name}</span>
            {isDocente && (
              <span className="inline-flex items-center gap-1 text-xs text-teal-700 font-medium">
                👨‍🏫 Docente
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">{formatCommentDate(comment.created_at)}</p>
          <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{comment.mensaje}</p>

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 ml-4 border-l-2 border-gray-200 pl-4 space-y-3">
              {comment.replies.map(reply => (
                <CommentCard key={reply.id} comment={reply} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
