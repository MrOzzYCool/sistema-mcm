"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getAccessToken } from "@/lib/get-token";
import { Course, ContenidoSemana, Tarea } from "@/types/course";
import {
  ArrowLeft, Video as VideoIcon, FileText, ExternalLink,
  ChevronDown, Upload, X, Plus, Loader2, Users, ClipboardList,
  CheckCircle2, Clock, AlertCircle, Trash2, FileSpreadsheet, Image,
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

interface Material {
  id: string;
  curso_id: string;
  semana: number | null;
  nombre_archivo: string;
  tipo_archivo: string;
  tamano: number;
  url: string;
  fecha_subida: string;
}

function getIconForType(tipo: string) {
  switch (tipo) {
    case "pdf": return <FileText size={16} className="text-red-600" />;
    case "mp4": return <VideoIcon size={16} className="text-blue-600" />;
    case "docx": return <FileText size={16} className="text-blue-500" />;
    case "xlsx": return <FileSpreadsheet size={16} className="text-green-600" />;
    case "pptx": return <FileText size={16} className="text-orange-500" />;
    case "jpg": case "png": return <Image size={16} className="text-purple-500" />;
    default: return <FileText size={16} className="text-gray-500" />;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocenteCursoPage() {
  const params = useParams();
  const cursoId = params.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("contenido");
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set([1]));
  const [uploading, setUploading] = useState(false);
  const [uploadWeek, setUploadWeek] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMateriales = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/portal/materiales?curso_id=${cursoId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setMateriales(data.materiales ?? []);
    }
  }, [cursoId]);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: courseData } = await supabase.from("cursos").select("*").eq("id", cursoId).single();
        if (!courseData) { setError("Curso no encontrado"); setLoading(false); return; }
        setCourse(courseData);
        await fetchMateriales();
      } catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [cursoId, fetchMateriales]);

  const toggleWeek = (week: number) => {
    setOpenWeeks(prev => { const next = new Set(prev); if (next.has(week)) next.delete(week); else next.add(week); return next; });
  };

  function triggerUpload(semana: number | null) {
    setUploadWeek(semana);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sesion no disponible");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("curso_id", cursoId);
      if (uploadWeek !== null) formData.append("semana", String(uploadWeek));
      formData.append("seccion", "material");

      const res = await fetch("/api/portal/materiales", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error subiendo archivo");

      alert(`Archivo "${file.name}" subido correctamente`);
      await fetchMateriales();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al subir archivo");
    } finally {
      setUploading(false);
      setUploadWeek(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(materialId: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch("/api/portal/materiales", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ material_id: materialId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await fetchMateriales();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error eliminando");
    }
  }

  const getMaterialesForWeek = (week: number) => materiales.filter(m => m.semana === week);

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
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" className="hidden"
        accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.mp4"
        onChange={handleFileSelected} />

      <Link href="/aula-virtual-docente" className="inline-flex items-center gap-1 text-sm text-[#C62828] hover:underline mb-4">
        <ArrowLeft size={16} /> Volver a mis cursos
      </Link>

      {/* Course header */}
      <div className="bg-gradient-to-r from-[#C62828] to-[#8E0000] rounded-xl p-6 mb-6 text-white">
        <h1 className="text-2xl font-bold">{displayName}</h1>
        <p className="text-white/70 text-sm mt-1">Ciclo {course.ciclo_perteneciente} · {course.creditos} créditos</p>
      </div>

      {/* Upload indicator */}
      {uploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-blue-600" />
          <span className="text-sm text-blue-700">Subiendo archivo...</span>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm mb-6 overflow-x-auto">
        <div className="flex border-b border-gray-200 min-w-max">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? "text-[#C62828]" : "text-gray-500 hover:text-[#C62828]"}`}
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
            <button onClick={() => triggerUpload(null)} disabled={uploading}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-[#C62828] px-3 py-1.5 rounded-lg hover:bg-[#8E0000] transition-colors disabled:opacity-50">
              <Plus size={14} /> Agregar material
            </button>
          </div>
          {Array.from({ length: 16 }, (_, i) => i + 1).map(week => {
            const isOpen = openWeeks.has(week);
            const weekMats = getMaterialesForWeek(week);
            return (
              <div key={week} className={`bg-white rounded-lg shadow-sm overflow-hidden ${isOpen ? "border-l-4 border-[#C62828]" : "border border-gray-200"}`}>
                <button onClick={() => toggleWeek(week)} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50">
                  <span className="font-medium text-gray-800 text-sm">Semana {week}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{weekMats.length} archivos</span>
                    <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 border-t border-gray-100">
                    {weekMats.length > 0 ? (
                      <ul className="space-y-2 mt-3">
                        {weekMats.map(mat => (
                          <li key={mat.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 group">
                            {getIconForType(mat.tipo_archivo)}
                            <div className="flex-1 min-w-0">
                              <a href={mat.url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 hover:text-[#C62828] truncate block">{mat.nombre_archivo}</a>
                              <p className="text-[10px] text-gray-400">{formatSize(mat.tamano)} · {mat.tipo_archivo.toUpperCase()}</p>
                            </div>
                            <button onClick={() => handleDelete(mat.id, mat.nombre_archivo)}
                              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-400 mt-3 italic">Sin contenido para esta semana.</p>
                    )}
                    <button onClick={() => triggerUpload(week)} disabled={uploading}
                      className="mt-3 text-xs text-[#C62828] hover:underline flex items-center gap-1 disabled:opacity-50">
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
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Tareas del curso</h2>
          <p className="text-sm text-gray-400 text-center py-8">Funcionalidad de tareas disponible pr&oacute;ximamente.</p>
        </div>
      )}

      {/* Other tabs */}
      {activeTab !== "contenido" && activeTab !== "tareas" && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-400 text-center py-8">
            {tabs.find(t => t.id === activeTab)?.label} — disponible pr&oacute;ximamente.
          </p>
        </div>
      )}
    </div>
  );
}
