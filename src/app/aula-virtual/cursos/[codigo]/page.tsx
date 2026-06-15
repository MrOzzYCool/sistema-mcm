"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Course, ContenidoSemana, Tarea } from "@/types/course";
import {
  ArrowLeft, Video as VideoIcon, FileText, ExternalLink,
  ChevronDown, User, MonitorPlay, Upload, X, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";

type TabId = "silabo" | "contenido" | "tareas" | "foros" | "notas" | "zoom";
const tabs: { id: TabId; label: string }[] = [
  { id: "silabo", label: "Sílabo" }, { id: "contenido", label: "Contenido" },
  { id: "tareas", label: "Tareas" }, { id: "foros", label: "Foros" },
  { id: "notas", label: "Notas" }, { id: "zoom", label: "Zoom" },
];

const seedContent: ContenidoSemana[] = [
  { id: "s1", curso_id: "", semana: 1, titulo: "Guía de Bienvenida al Curso", tipo: "pdf", url: "#", created_at: "" },
  { id: "s2", curso_id: "", semana: 1, titulo: "Video Introductorio", tipo: "video", url: "#", created_at: "" },
  { id: "s3", curso_id: "", semana: 1, titulo: "Recursos adicionales", tipo: "link", url: "#", created_at: "" },
];
const seedTareas: Tarea[] = [
  { id: "t1", curso_id: "", titulo: "Tarea 1: Ensayo introductorio", fecha_entrega: "2026-06-01", estado: "pendiente", created_at: "" },
  { id: "t2", curso_id: "", titulo: "Tarea 2: Mapa conceptual", fecha_entrega: "2026-06-08", estado: "pendiente", created_at: "" },
  { id: "t3", curso_id: "", titulo: "Tarea 3: Informe de lectura", fecha_entrega: "2026-05-20", estado: "vencido", created_at: "" },
  { id: "t4", curso_id: "", titulo: "Práctica calificada 1", fecha_entrega: "2026-05-15", estado: "entregado", created_at: "" },
];

function getCarreraSlug(carrera: string): string {
  const map: Record<string, string> = {
    "asistencia administrativa": "asistencia-administrativa",
    "gestión de recursos humanos": "recursos-humanos",
    "gestion de recursos humanos": "recursos-humanos",
    "recursos humanos": "recursos-humanos",
  };
  const lower = carrera.toLowerCase().trim();
  return map[lower] ?? lower.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function getBannerUrl(course: { carrera?: string | null; imagen_url?: string | null }): string {
  if (course.imagen_url?.trim()) return course.imagen_url;
  if (course.carrera) return `/cursos/banner/${getCarreraSlug(course.carrera)}.jpg`;
  return `/cursos/banner/asistencia-administrativa.jpg`;
}

function getIconForType(tipo: string) {
  switch (tipo) {
    case "pdf": return <FileText size={18} className="text-red-600" />;
    case "video": return <VideoIcon size={18} className="text-blue-600" />;
    case "link": return <ExternalLink size={18} className="text-green-600" />;
    default: return <FileText size={18} className="text-gray-500" />;
  }
}
function getStatusBadge(estado: string) {
  switch (estado) {
    case "pendiente": return <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800"><Clock size={12} /> Pendiente</span>;
    case "entregado": return <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-800"><CheckCircle2 size={12} /> Entregado</span>;
    case "vencido": return <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-800"><AlertCircle size={12} /> Vencido</span>;
    default: return null;
  }
}

export default function CourseDetailPage() {
  const params = useParams();
  const codigo = params.codigo as string;
  const [course, setCourse] = useState<Course | null>(null);
  const [content, setContent] = useState<ContenidoSemana[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("contenido");
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set([1]));
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedTarea, setSelectedTarea] = useState<Tarea | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        let courseData: Course | null = null;
        const { data: byCodigo } = await supabase.from("cursos").select("*").eq("codigo", codigo).single();
        if (byCodigo) courseData = byCodigo;
        else {
          const { data: byId } = await supabase.from("cursos").select("*").eq("id", codigo).single();
          if (byId) courseData = byId;
        }
        if (!courseData) { setError("Curso no encontrado"); setLoading(false); return; }
        setCourse(courseData);
        const { data: contentData } = await supabase.from("contenido_semanas").select("*").eq("curso_id", courseData.id).order("semana", { ascending: true });
        setContent(contentData && contentData.length > 0 ? contentData : seedContent);
        const { data: tareasData } = await supabase.from("entregas").select("*").eq("curso_id", courseData.id);
        setTareas(tareasData && tareasData.length > 0 ? tareasData : seedTareas);
      } catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [codigo]);

  const toggleWeek = (week: number) => { setOpenWeeks((prev) => { const next = new Set(prev); if (next.has(week)) next.delete(week); else next.add(week); return next; }); };
  const getContentForWeek = (week: number) => content.filter((c) => c.semana === week);
  const openUpload = (tarea: Tarea) => { setSelectedTarea(tarea); setShowUploadModal(true); };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-500 animate-pulse">Cargando curso...</p></div>;
  if (error || !course) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <p className="text-gray-500">{error || "Curso no encontrado"}</p>
      <Link href="/aula-virtual" className="text-[#1e293b] hover:underline flex items-center gap-1"><ArrowLeft size={16} /> Volver</Link>
    </div>
  );

  const displayName = course.nombre ?? course.nombre_curso ?? "Curso";

  return (
    <div className="py-4 w-full max-w-[1200px] mx-auto">
      <Link href="/aula-virtual" className="inline-flex items-center gap-1 text-sm text-[#1e293b] hover:underline mb-4">
        <ArrowLeft size={16} /> Volver a cursos
      </Link>
      {/* Banner */}
      <div className="relative rounded-xl overflow-hidden mb-6 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getBannerUrl(course)} alt={displayName} className="w-full h-48 lg:h-56 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white drop-shadow-md">{displayName}</h1>
              <div className="flex items-center gap-2 mt-2 text-sm text-white/90"><User size={14} /><span>{course.profesor || "Docente no asignado"}</span></div>
              <div className="flex items-center gap-3 mt-1 text-xs text-white/75">
                {course.carrera && <span>{course.carrera}</span>}
                {course.carrera && course.periodo && <span>·</span>}
                {course.periodo && <span>{course.periodo}</span>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {course.modalidad && <span className="text-xs bg-white/90 text-gray-700 px-3 py-1 rounded-full font-medium">{course.modalidad}</span>}
              <a href="#" className="inline-flex items-center gap-2 bg-[#1e293b] text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-[#0f172a] transition-colors"><MonitorPlay size={16} /> Clase en Vivo</a>
            </div>
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm mb-6 overflow-x-auto">
        <div className="flex border-b border-gray-200 min-w-max">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? "text-[#1e293b]" : "text-gray-500 hover:text-[#1e293b]"}`}
              style={activeTab === tab.id ? { borderBottomWidth: "3px", borderBottomColor: "#1e293b" } : {}}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {/* Content */}
      {activeTab === "contenido" && (
        <div className="space-y-3">
          {Array.from({ length: 16 }, (_, i) => i + 1).map((week) => {
            const isOpen = openWeeks.has(week);
            const weekContent = getContentForWeek(week);
            return (
              <div key={week} className={`bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-200 ${isOpen ? "border-l-4 border-[#1e293b]" : "border border-gray-200"}`}>
                <button onClick={() => toggleWeek(week)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors">
                  <span className="font-medium text-gray-800">Semana {week}</span>
                  <ChevronDown size={20} className={`text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 border-t border-gray-100">
                    {weekContent.length > 0 ? (
                      <ul className="space-y-2 mt-3">{weekContent.map((item) => (
                        <li key={item.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                          {getIconForType(item.tipo)}<span className="flex-1 text-sm text-gray-700">{item.titulo}</span>
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[#1e293b] hover:underline px-3 py-1 border border-[#1e293b] rounded-md">{item.tipo === "pdf" ? "Descargar" : "Ver"}</a>
                        </li>
                      ))}</ul>
                    ) : <p className="text-sm text-gray-400 mt-3 italic">Contenido no disponible aún para esta semana.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {activeTab === "tareas" && (
        <div className="space-y-3">
          {tareas.map((tarea) => (
            <div key={tarea.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800">{tarea.titulo}</h3>
                  <p className="text-xs text-gray-500 mt-1">Entrega: {new Date(tarea.fecha_entrega).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}</p>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(tarea.estado)}
                  {tarea.estado === "pendiente" && (
                    <button onClick={() => openUpload(tarea)} className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-[#1e293b] px-4 py-2 rounded-lg hover:bg-[#0f172a] transition-colors"><Upload size={14} /> Entregar</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {activeTab !== "contenido" && activeTab !== "tareas" && (
        <div className="bg-white rounded-xl shadow-sm p-12 flex items-center justify-center min-h-[200px]">
          <p className="text-gray-400 text-center"><span className="block text-lg font-medium text-gray-500 mb-1">{tabs.find((t) => t.id === activeTab)?.label}</span>Disponible próximamente.</p>
        </div>
      )}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowUploadModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
            <button onClick={() => setShowUploadModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            <h2 className="text-lg font-bold text-gray-800 mb-1">Entregar tarea</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedTarea?.titulo}</p>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#1e293b] transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Upload size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">Seleccionar archivo</p>
              <p className="text-xs text-gray-400 mt-1">PDF, DOCX, ZIP (máx. 10MB)</p>
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.zip,.rar" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
              <button className="px-5 py-2 text-sm font-medium text-white bg-[#1e293b] rounded-lg hover:bg-[#0f172a]">Subir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
