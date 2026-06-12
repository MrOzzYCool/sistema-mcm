"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getAccessToken } from "@/lib/get-token";
import { Course, ContenidoSemana, Tarea } from "@/types/course";
import {
  ArrowLeft, Video as VideoIcon, FileText, ExternalLink,
  ChevronDown, User, Upload, X, Plus, Loader2, Users, ClipboardList,
  CheckCircle2, Clock, AlertCircle, Trash2,
} from "lucide-react";

type TabId = "contenido" | "tareas" | "notas" | "alumnos" | "asistencia" | "foros";
const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: "contenido", label: "Contenido", icon: FileText },
  { id: "tareas", label: "Tareas", icon: ClipboardList },
  { id: "notas", label: "Notas", icon: CheckCircle2 },
  { id: "alumnos", label: "Alumnos", icon: Users },
  { id: "asistencia", label: "Asistencia", icon: Clock },
  { id: "foros", label: "Foros", icon: ExternalLink },
];

const seedContent: ContenidoSemana[] = [
  { id: "s1", curso_id: "", semana: 1, titulo: "Guía de Bienvenida al Curso", tipo: "pdf", url: "#", created_at: "" },
  { id: "s2", curso_id: "", semana: 1, titulo: "Video Introductorio", tipo: "video", url: "#", created_at: "" },
];
const seedTareas: Tarea[] = [
  { id: "t1", curso_id: "", titulo: "Tarea 1: Ensayo introductorio", fecha_entrega: "2026-06-01", estado: "pendiente", created_at: "" },
  { id: "t2", curso_id: "", titulo: "Tarea 2: Mapa conceptual", fecha_entrega: "2026-06-08", estado: "pendiente", created_at: "" },
];

function getIconForType(tipo: string) {
  switch (tipo) {
    case "pdf": return <FileText size={16} className="text-red-600" />;
    case "video": return <VideoIcon size={16} className="text-blue-600" />;
    case "link": return <ExternalLink size={16} className="text-green-600" />;
    default: return <FileText size={16} className="text-gray-500" />;
  }
}

export default function DocenteCursoPage() {
  const params = useParams();
  const cursoId = params.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [content, setContent] = useState<ContenidoSemana[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("contenido");
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set([1]));

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: courseData } = await supabase.from("cursos").select("*").eq("id", cursoId).single();
        if (!courseData) { setError("Curso no encontrado"); setLoading(false); return; }
        setCourse(courseData);

        const { data: contentData } = await supabase.from("contenido_semanas").select("*").eq("curso_id", cursoId).order("semana");
        setContent(contentData && contentData.length > 0 ? contentData : seedContent);

        const { data: tareasData } = await supabase.from("entregas").select("*").eq("curso_id", cursoId);
        setTareas(tareasData && tareasData.length > 0 ? tareasData : seedTareas);
      } catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [cursoId]);

  const toggleWeek = (week: number) => {
    setOpenWeeks(prev => { const next = new Set(prev); if (next.has(week)) next.delete(week); else next.add(week); return next; });
  };
  const getContentForWeek = (week: number) => content.filter(c => c.semana === week);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;
  if (error || !course) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <p className="text-gray-500">{error || "Curso no encontrado"}</p>
      <Link href="/aula-virtual-docente" className="text-[#C62828] hover:underline flex items-center gap-1"><ArrowLeft size={16} /> Volver</Link>
    </div>
  );

  const displayName = course.nombre ?? course.nombre_curso ?? "Curso";

  return (
    <div className="py-4 w-full">
      <Link href="/aula-virtual-docente" className="inline-flex items-center gap-1 text-sm text-[#C62828] hover:underline mb-4">
        <ArrowLeft size={16} /> Volver a mis cursos
      </Link>

      {/* Course header */}
      <div className="bg-gradient-to-r from-[#C62828] to-[#8E0000] rounded-xl p-6 mb-6 text-white">
        <h1 className="text-2xl font-bold">{displayName}</h1>
        <p className="text-white/70 text-sm mt-1">Ciclo {course.ciclo_perteneciente} · {course.creditos} créditos</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm mb-6 overflow-x-auto">
        <div className="flex border-b border-gray-200 min-w-max">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? "text-[#C62828] border-b-3 border-[#C62828]" : "text-gray-500 hover:text-[#C62828]"}`}
              style={activeTab === tab.id ? { borderBottomWidth: "3px", borderBottomColor: "#C62828" } : {}}>
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Contenido */}
      {activeTab === "contenido" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-800">Material por Semana</h2>
            <button className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-[#C62828] px-3 py-1.5 rounded-lg hover:bg-[#8E0000] transition-colors">
              <Plus size={14} /> Agregar material
            </button>
          </div>
          {Array.from({ length: 16 }, (_, i) => i + 1).map(week => {
            const isOpen = openWeeks.has(week);
            const weekContent = getContentForWeek(week);
            return (
              <div key={week} className={`bg-white rounded-lg shadow-sm overflow-hidden ${isOpen ? "border-l-4 border-[#C62828]" : "border border-gray-200"}`}>
                <button onClick={() => toggleWeek(week)} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50">
                  <span className="font-medium text-gray-800 text-sm">Semana {week}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{weekContent.length} archivos</span>
                    <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 border-t border-gray-100">
                    {weekContent.length > 0 ? (
                      <ul className="space-y-2 mt-3">
                        {weekContent.map(item => (
                          <li key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 group">
                            {getIconForType(item.tipo)}
                            <span className="flex-1 text-sm text-gray-700">{item.titulo}</span>
                            <button className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-400 mt-3 italic">Sin contenido. Usa el botón para agregar material.</p>
                    )}
                    <button className="mt-3 text-xs text-[#C62828] hover:underline flex items-center gap-1">
                      <Upload size={12} /> Subir archivo a esta semana
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Tareas */}
      {activeTab === "tareas" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-800">Tareas del curso</h2>
            <button className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-[#C62828] px-3 py-1.5 rounded-lg hover:bg-[#8E0000] transition-colors">
              <Plus size={14} /> Nueva tarea
            </button>
          </div>
          {tareas.map(tarea => (
            <div key={tarea.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-800 text-sm">{tarea.titulo}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Entrega: {new Date(tarea.fecha_entrega).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">0 entregas</span>
                  <button className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
          {tareas.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No hay tareas creadas aún.</p>}
        </div>
      )}

      {/* Tab: Notas */}
      {activeTab === "notas" && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Libro de Notas</h2>
          <p className="text-sm text-gray-400 text-center py-8">
            Las notas estarán disponibles cuando se configuren las evaluaciones del curso.
          </p>
        </div>
      )}

      {/* Tab: Alumnos */}
      {activeTab === "alumnos" && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Alumnos Matriculados</h2>
          <p className="text-sm text-gray-400 text-center py-8">
            La lista de alumnos se mostrará según los inscritos en este ciclo y carrera.
          </p>
        </div>
      )}

      {/* Tab: Asistencia */}
      {activeTab === "asistencia" && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Control de Asistencia</h2>
            <button className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-[#C62828] px-3 py-1.5 rounded-lg hover:bg-[#8E0000]">
              <Plus size={14} /> Nueva sesión
            </button>
          </div>
          <p className="text-sm text-gray-400 text-center py-8">
            Registra la asistencia de cada sesión de clase.
          </p>
        </div>
      )}

      {/* Tab: Foros */}
      {activeTab === "foros" && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Foros de Discusión</h2>
            <button className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-[#C62828] px-3 py-1.5 rounded-lg hover:bg-[#8E0000]">
              <Plus size={14} /> Crear foro
            </button>
          </div>
          <p className="text-sm text-gray-400 text-center py-8">
            Crea foros para que los alumnos participen en debates académicos.
          </p>
        </div>
      )}
    </div>
  );
}
