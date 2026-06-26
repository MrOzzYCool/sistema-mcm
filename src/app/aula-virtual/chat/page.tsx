"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getAccessToken } from "@/lib/get-token";
import { useAuth } from "@/lib/auth-context";
import { Plus, Send, Loader2, MessageCircle, Search, ChevronDown, User as UserIcon } from "lucide-react";

interface Conversacion {
  id: string; tipo: string; curso_id: string | null; display_name: string;
  last_message: { contenido: string; sender_name: string; created_at: string } | null;
}

interface Mensaje { id: string; sender_id: string; sender_name: string; contenido: string; created_at: string; }
interface Companero { id: string; nombre_completo: string; genero: string | null; }
interface MiCurso { id: string; nombre_curso: string; }

export default function ChatPage() {
  const { user } = useAuth();
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMsg, setNuevoMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // Crear chat state
  const [showCrear, setShowCrear] = useState(false);
  const [misCursos, setMisCursos] = useState<MiCurso[]>([]);
  const [cursoSeleccionado, setCursoSeleccionado] = useState("");
  const [companeros, setCompaneros] = useState<Companero[]>([]);
  const [searchName, setSearchName] = useState("");
  const [loadingCompaneros, setLoadingCompaneros] = useState(false);

  const msgEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchConversaciones = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch("/api/portal/chat?action=conversaciones", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const data = await res.json(); setConversaciones(data.conversaciones ?? []); }
    setLoading(false);
  }, []);

  const fetchMensajes = useCallback(async (convId: string) => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/portal/chat?action=mensajes&conv_id=${convId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const data = await res.json(); setMensajes(data.mensajes ?? []); }
  }, []);

  useEffect(() => { fetchConversaciones(); }, [fetchConversaciones]);

  // Load cursos del alumno via API
  useEffect(() => {
    async function loadCursos() {
      if (!user) return;
      const token = await getAccessToken();
      if (!token) return;
      // Get mis cursos from the aula API
      const res = await fetch("/api/portal/mis-cursos-aula", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const cursos = (data.cursos ?? data ?? []).map((c: any) => ({ id: c.id ?? c.curso_id, nombre_curso: c.nombre_curso ?? c.nombre ?? c.nombre_curso }));
        setMisCursos(cursos);
      }
    }
    loadCursos();
  }, [user]);

  // Poll messages when conversation is active
  useEffect(() => {
    if (!activeConv) return;
    fetchMensajes(activeConv);
    pollRef.current = setInterval(() => fetchMensajes(activeConv), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeConv, fetchMensajes]);

  // Scroll to bottom when messages change
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes]);

  // Load companeros when course selected
  useEffect(() => {
    if (!cursoSeleccionado) { setCompaneros([]); return; }
    async function load() {
      setLoadingCompaneros(true);
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/portal/chat?action=companeros&curso_id=${cursoSeleccionado}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setCompaneros(data.companeros ?? []); }
      setLoadingCompaneros(false);
    }
    load();
  }, [cursoSeleccionado]);

  async function handleSend() {
    if (!nuevoMsg.trim() || !activeConv) return;
    setSending(true);
    const token = await getAccessToken();
    if (!token) { setSending(false); return; }
    await fetch("/api/portal/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "enviar_mensaje", conv_id: activeConv, contenido: nuevoMsg.trim() }),
    });
    setNuevoMsg("");
    setSending(false);
    await fetchMensajes(activeConv);
  }

  async function handleSelectCompanero(companeroId: string) {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch("/api/portal/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "crear_conversacion", target_user_id: companeroId, curso_id: cursoSeleccionado }),
    });
    if (res.ok) {
      const data = await res.json();
      setActiveConv(data.conversacion_id);
      setShowCrear(false);
      setCursoSeleccionado("");
      setSearchName("");
      await fetchConversaciones();
    }
  }

  function formatTime(d: string) {
    try { return new Date(d).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
  }

  const filteredCompaneros = companeros.filter(c => !searchName || c.nombre_completo.toLowerCase().includes(searchName.toLowerCase()));

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white rounded-xl shadow-sm overflow-hidden mt-4">
      {/* Left panel - conversations list */}
      <div className="w-80 border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Chat</h2>
          <button onClick={() => { setShowCrear(true); setActiveConv(null); }} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            <Plus size={12} /> Crear
          </button>
        </div>

        <div className="p-3">
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500">
            <option>Todos los mensajes</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
          ) : conversaciones.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-3 text-sm text-gray-400">
              <MessageCircle size={16} className="text-gray-300" />
              Aún no tienes mensajes
            </div>
          ) : (
            conversaciones.map(conv => (
              <button key={conv.id} onClick={() => { setActiveConv(conv.id); setShowCrear(false); }}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${activeConv === conv.id ? "bg-blue-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <UserIcon size={16} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{conv.display_name}</p>
                    {conv.last_message && (
                      <p className="text-xs text-gray-400 truncate">{conv.last_message.contenido}</p>
                    )}
                  </div>
                  {conv.last_message && (
                    <span className="text-[10px] text-gray-400 shrink-0">{formatTime(conv.last_message.created_at)}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel - chat or create */}
      <div className="flex-1 flex flex-col">
        {showCrear ? (
          /* Create new chat */
          <div className="p-6">
            <h3 className="font-bold text-gray-800 text-lg mb-4">Nuevo Mensaje</h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">Selecciona el curso y sección</label>
              <select value={cursoSeleccionado} onChange={e => setCursoSeleccionado(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">Selecciona el curso y sección</option>
                {misCursos.map(c => <option key={c.id} value={c.id}>{c.nombre_curso}</option>)}
              </select>
            </div>

            {cursoSeleccionado && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">Buscar compañero</label>
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={searchName} onChange={e => setSearchName(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>

                {loadingCompaneros ? (
                  <Loader2 size={16} className="animate-spin text-gray-300 mx-auto" />
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {filteredCompaneros.length === 0 && <p className="text-xs text-gray-400 py-2">No se encontraron compañeros.</p>}
                    {filteredCompaneros.map(comp => (
                      <button key={comp.id} onClick={() => handleSelectCompanero(comp.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <UserIcon size={14} className="text-gray-400" />
                        </div>
                        <span className="text-sm text-gray-700">{comp.nombre_completo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeConv ? (
          /* Active conversation */
          <>
            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-200 bg-white">
              <p className="font-semibold text-gray-800">{conversaciones.find(c => c.id === activeConv)?.display_name ?? "Chat"}</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {mensajes.map(msg => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${isMe ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                      {!isMe && <p className="text-[10px] font-medium mb-0.5 opacity-70">{msg.sender_name}</p>}
                      <p>{msg.contenido}</p>
                      <p className={`text-[9px] mt-1 ${isMe ? "text-blue-200" : "text-gray-400"}`}>{formatTime(msg.created_at)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={msgEndRef} />
            </div>

            {/* Input */}
            <div className="px-5 py-3 border-t border-gray-200 flex items-center gap-2">
              <input value={nuevoMsg} onChange={e => setNuevoMsg(e.target.value)}
                placeholder="Escribe un mensaje..."
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleSend} disabled={sending || !nuevoMsg.trim()}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-40 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
              <MessageCircle size={40} className="text-gray-300" />
            </div>
            <p className="text-gray-600 font-medium">Aún no tienes mensajes</p>
            <p className="text-sm text-gray-400">Crea un chat y envía tu primer mensaje</p>
            <button onClick={() => setShowCrear(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              + Crear chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
