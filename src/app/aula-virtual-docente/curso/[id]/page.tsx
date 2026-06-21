"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getAccessToken } from "@/lib/get-token";
import { Course } from "@/types/course";
import MaterialViewer from "@/components/aula-virtual/MaterialViewer";
import {
  ArrowLeft, FileText, ChevronDown, ChevronUp, Upload, Plus, Loader2,
  Users, ClipboardList, CheckCircle2, Clock, ExternalLink, Trash2,
  Eye, EyeOff, MessageSquare, BookOpen, PenTool, FileSpreadsheet, Image,
  Video as VideoIcon,
} from "lucide-react";

type TabId = "silabo" | "contenido" | "evaluaciones" | "tareas" | "foros" | "notas" | "alumnos" | "asistencia" | "anuncios" | "teams";
const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: "silabo", label: "Sílabo", icon: FileText },
  { id: "contenido", label: "Contenido", icon: FileText },
  { id: "evaluaciones", label: "Evaluaciones", icon: ClipboardList },
  { id: "tareas", label: "Tareas", icon: ClipboardList },
  { id: "foros", label: "Foros", icon: ExternalLink },
  { id: "notas", label: "Notas", icon: CheckCircle2 },
  { id: "alumnos", label: "Alumnos", icon: Users },
  { id: "asistencia", label: "Asistencia", icon: Clock },
  { id: "anuncios", label: "Anuncios", icon: ExternalLink },
  { id: "teams", label: "Teams", icon: ExternalLink },
];

interface Material {
  id: string; semana: number | null; nombre_archivo: string; tipo_archivo: string;
  tamano: number; url: string; visible: boolean; seccion: string;
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
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<{ semana: number | null; seccion: string }>({ semana: null, seccion: "material" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Material Viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerMaterial, setViewerMaterial] = useState<Material | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerList, setViewerList] = useState<Material[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

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

  const toggleWeek = (w: number) => setOpenWeeks(prev => { const n = new Set(prev); n.has(w) ? n.delete(w) : n.add(w); return n; });
  const toggleSection = (key: string) => setOpenSections(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  function triggerUpload(semana: number | null, seccion: string) {
    setUploadTarget({ semana, seccion });
    fileInputRef.current?.click();
  }

  // Handle drag-drop from DropZone components
  useEffect(() => {
    async function handleDrop(e: Event) {
      const { file, seccion } = (e as CustomEvent).detail;
      if (!file) return;
      setUploading(true);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Sesion no disponible");
        const formData = new FormData();
        formData.append("file", file);
        formData.append("curso_id", cursoId);
        formData.append("seccion", seccion);
        const res = await fetch("/api/portal/materiales", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error subiendo archivo");
        await fetchMateriales();
      } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
      finally { setUploading(false); }
    }
    window.addEventListener("silabo-drop", handleDrop);
    return () => window.removeEventListener("silabo-drop", handleDrop);
  }, [cursoId, fetchMateriales]);

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
      if (uploadTarget.semana !== null) formData.append("semana", String(uploadTarget.semana));
      formData.append("seccion", uploadTarget.seccion);
      const res = await fetch("/api/portal/materiales", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error subiendo archivo");
      await fetchMateriales();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`Eliminar "${nombre}"?`)) return;
    const token = await getAccessToken();
    if (!token) return;
    await fetch("/api/portal/materiales", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ material_id: id }) });
    await fetchMateriales();
  }

  async function toggleVisibility(id: string, currentVisible: boolean) {
    const token = await getAccessToken();
    if (!token) return;
    await fetch("/api/portal/materiales", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ material_id: id, visible: !currentVisible }) });
    await fetchMateriales();
  }

  async function openFile(materialId: string) {
    // Find the material and its sibling list for navigation
    const mat = materiales.find(m => m.id === materialId);
    if (!mat) return;

    // Get siblings (same semana + seccion) for Anterior/Siguiente navigation
    const siblings = materiales.filter(m => m.semana === mat.semana && m.seccion === mat.seccion);
    const idx = siblings.findIndex(m => m.id === materialId);

    setViewerMaterial(mat);
    setViewerList(siblings);
    setViewerIndex(idx >= 0 ? idx : 0);
    setViewerOpen(true);
    setViewerLoading(true);
    setViewerUrl(null);

    const token = await getAccessToken();
    if (!token) { setViewerLoading(false); return; }
    const res = await fetch(`/api/portal/materiales/presigned?material_id=${materialId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const { url } = await res.json();
      setViewerUrl(url);
    }
    setViewerLoading(false);
  }

  async function handleViewerNavigate(materialId: string) {
    const mat = viewerList.find(m => m.id === materialId);
    if (!mat) return;
    const idx = viewerList.findIndex(m => m.id === materialId);

    setViewerMaterial(mat);
    setViewerIndex(idx >= 0 ? idx : 0);
    setViewerLoading(true);
    setViewerUrl(null);

    const token = await getAccessToken();
    if (!token) { setViewerLoading(false); return; }
    const res = await fetch(`/api/portal/materiales/presigned?material_id=${materialId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const { url } = await res.json();
      setViewerUrl(url);
    }
    setViewerLoading(false);
  }

  const getMatsForWeek = (week: number, seccion: string) => materiales.filter(m => m.semana === week && m.seccion === seccion);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;
  if (error || !course) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <p className="text-gray-500">{error || "Curso no encontrado"}</p>
      <Link href="/aula-virtual-docente" className="text-[#C62828] hover:underline flex items-center gap-1"><ArrowLeft size={16} /> Volver</Link>
    </div>
  );

  const displayName = course.nombre ?? course.nombre_curso ?? "Curso";

  // If viewer is open, show it INLINE (within the layout, sidebar stays)
  if (viewerOpen && viewerMaterial) {
    return (
      <div className="h-[calc(100vh-64px)]">
        <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.mp4" onChange={handleFileSelected} />
        <MaterialViewer
          material={viewerMaterial}
          presignedUrl={viewerUrl}
          allMaterials={viewerList}
          currentIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
          onNavigate={handleViewerNavigate}
          loading={viewerLoading}
        />
      </div>
    );
  }

  return (
    <div className="py-4 w-full max-w-[1200px] mx-auto">
      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.mp4" onChange={handleFileSelected} />

      <Link href="/aula-virtual-docente" className="inline-flex items-center gap-1 text-sm text-[#C62828] hover:underline mb-4">
        <ArrowLeft size={16} /> Volver a mis cursos
      </Link>

      <div className="bg-gradient-to-r from-[#C62828] to-[#8E0000] rounded-xl p-6 mb-6 text-white">
        <h1 className="text-2xl font-bold">{displayName}</h1>
        <p className="text-white/70 text-sm mt-1">Ciclo {course.ciclo_perteneciente} &middot; {course.creditos} cr&eacute;ditos</p>
      </div>

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

      {/* Tab: Contenido — Semanas con 3 secciones */}
      {activeTab === "contenido" && (
        <div className="space-y-3">
          {Array.from({ length: 16 }, (_, i) => i + 1).map(week => {
            const isOpen = openWeeks.has(week);
            const matsMaterial = getMatsForWeek(week, "material");
            const matsActividad = getMatsForWeek(week, "actividad");

            return (
              <div key={week} className={`bg-white rounded-lg shadow-sm overflow-hidden ${isOpen ? "border-l-4 border-[#C62828]" : "border border-gray-200"}`}>
                <button onClick={() => toggleWeek(week)} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50">
                  <span className="font-medium text-gray-800 text-sm">Semana {week}</span>
                  <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100">
                    {/* Secci&oacute;n 1: Foro/Anuncio (siempre visible) */}
                    <SectionHeader title={`Foro de Consultas - Semana ${week}`} icon={<MessageSquare size={16} className="text-blue-500" />}
                      sectionKey={`foro-${week}`} isOpen={openSections.has(`foro-${week}`)} toggle={toggleSection} />
                    {openSections.has(`foro-${week}`) && (
                      <div className="px-5 pb-3">
                        <p className="text-xs text-gray-400 italic">Foro de consultas disponible para esta semana.</p>
                      </div>
                    )}

                    {/* Secci&oacute;n 2: Material de estudio */}
                    <SectionHeader title="Material de estudio" icon={<BookOpen size={16} className="text-green-500" />}
                      sectionKey={`mat-${week}`} isOpen={openSections.has(`mat-${week}`)} toggle={toggleSection}
                      onAdd={() => triggerUpload(week, "material")} addLabel="Subir material" />
                    {openSections.has(`mat-${week}`) && (
                      <div className="px-5 pb-3 space-y-2">
                        {matsMaterial.length > 0 ? matsMaterial.map(mat => (
                          <MaterialRow key={mat.id} mat={mat} onOpen={openFile} onDelete={handleDelete} onToggle={toggleVisibility} />
                        )) : <p className="text-xs text-gray-400 italic">Sin material. Usa el bot&oacute;n + para agregar.</p>}
                      </div>
                    )}

                    {/* Secci&oacute;n 3: Pon en pr&aacute;ctica lo aprendido */}
                    <SectionHeader title="Pon en pr&aacute;ctica lo aprendido" icon={<PenTool size={16} className="text-orange-500" />}
                      sectionKey={`act-${week}`} isOpen={openSections.has(`act-${week}`)} toggle={toggleSection}
                      onAdd={() => triggerUpload(week, "actividad")} addLabel="Subir actividad" />
                    {openSections.has(`act-${week}`) && (
                      <div className="px-5 pb-3 space-y-2">
                        {matsActividad.length > 0 ? matsActividad.map(mat => (
                          <MaterialRow key={mat.id} mat={mat} onOpen={openFile} onDelete={handleDelete} onToggle={toggleVisibility} />
                        )) : <p className="text-xs text-gray-400 italic">Sin actividades. Usa el bot&oacute;n + para agregar.</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Sílabo */}
      {activeTab === "silabo" && (
        <SilaboTab cursoId={cursoId} onOpenFile={openFile} triggerUpload={triggerUpload} materiales={materiales} />
      )}

      {/* Other tabs */}
      {activeTab !== "contenido" && activeTab !== "silabo" && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-400 text-center py-8">{tabs.find(t => t.id === activeTab)?.label} &mdash; disponible pr&oacute;ximamente.</p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, icon, sectionKey, isOpen, toggle, onAdd, addLabel }: {
  title: string; icon: React.ReactNode; sectionKey: string; isOpen: boolean;
  toggle: (key: string) => void; onAdd?: () => void; addLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-50 hover:bg-gray-50">
      <button onClick={() => toggle(sectionKey)} className="flex items-center gap-2 flex-1 text-left">
        {icon}
        <span className="text-sm font-medium text-gray-700">{title}</span>
        {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {onAdd && (
        <button onClick={onAdd} className="text-xs text-[#C62828] hover:underline flex items-center gap-1">
          <Plus size={12} /> {addLabel}
        </button>
      )}
    </div>
  );
}

function MaterialRow({ mat, onOpen, onDelete, onToggle }: {
  mat: Material; onOpen: (id: string) => void; onDelete: (id: string, name: string) => void; onToggle: (id: string, visible: boolean) => void;
}) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 group ${!mat.visible ? "opacity-50" : ""}`}>
      {getIconForType(mat.tipo_archivo)}
      <div className="flex-1 min-w-0">
        <button onClick={() => onOpen(mat.id)} className="text-sm text-gray-700 hover:text-[#C62828] truncate block text-left">{mat.nombre_archivo}</button>
        <p className="text-[10px] text-gray-400">{formatSize(mat.tamano)} &middot; {mat.tipo_archivo.toUpperCase()} {!mat.visible && <span className="text-red-500 font-medium ml-1">(Oculto para alumnos)</span>}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onToggle(mat.id, mat.visible)} title={mat.visible ? "Ocultar al alumno" : "Hacer visible"}
          className={`p-1 rounded ${mat.visible ? "text-gray-400 hover:text-orange-500" : "text-orange-500 hover:text-green-500"}`}>
          {mat.visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button onClick={() => onDelete(mat.id, mat.nombre_archivo)} className="p-1 text-gray-300 hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Sílabo Tab ──────────────────────────────────────────────────────────────

function SilaboTab({ cursoId, onOpenFile, triggerUpload, materiales }: {
  cursoId: string; onOpenFile: (id: string) => void;
  triggerUpload: (semana: number | null, seccion: string) => void;
  materiales: Material[];
}) {
  const silaboFiles = materiales.filter(m => m.seccion === "silabo");
  const sesionesFiles = materiales.filter(m => m.seccion === "sesiones");

  return (
    <div className="space-y-6">
      {/* Sílabo del curso */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-800">Sílabo del curso</h3>
            <p className="text-xs text-gray-400 mt-0.5">Documento oficial del sílabo</p>
          </div>
          <button onClick={() => triggerUpload(null, "silabo")}
            className="text-xs text-[#C62828] hover:underline flex items-center gap-1 border border-[#C62828] rounded-lg px-3 py-1.5">
            <Plus size={12} /> Subir sílabo
          </button>
        </div>
        {silaboFiles.length > 0 ? (
          <div className="space-y-3">
            {silaboFiles.map(mat => (
              <SilaboCard key={mat.id} mat={mat} onOpen={onOpenFile} />
            ))}
          </div>
        ) : (
          <DropZone seccion="silabo" label="Arrastra el sílabo aquí o haz clic para seleccionar" onTrigger={() => triggerUpload(null, "silabo")} />
        )}
      </div>

      {/* Sesiones de clase */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-800">Sesiones de clase</h3>
            <p className="text-xs text-gray-400 mt-0.5">Cronograma o programa de sesiones</p>
          </div>
          <button onClick={() => triggerUpload(null, "sesiones")}
            className="text-xs text-[#C62828] hover:underline flex items-center gap-1 border border-[#C62828] rounded-lg px-3 py-1.5">
            <Plus size={12} /> Subir sesiones
          </button>
        </div>
        {sesionesFiles.length > 0 ? (
          <div className="space-y-3">
            {sesionesFiles.map(mat => (
              <SilaboCard key={mat.id} mat={mat} onOpen={onOpenFile} />
            ))}
          </div>
        ) : (
          <DropZone seccion="sesiones" label="Arrastra las sesiones aquí o haz clic para seleccionar" onTrigger={() => triggerUpload(null, "sesiones")} />
        )}
      </div>
    </div>
  );
}

function DropZone({ seccion, label, onTrigger }: { seccion: string; label: string; onTrigger: () => void }) {
  const [dragOver, setDragOver] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    // The file from drop will be handled by the parent's file input mechanism
    // We trigger the upload click which opens the file picker
    // For actual drag-drop, we'd need to handle the file directly
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      // Dispatch a custom event with the file and seccion
      const event = new CustomEvent("silabo-drop", { detail: { file: files[0], seccion } });
      window.dispatchEvent(event);
    }
  }

  return (
    <div
      onClick={onTrigger}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`text-center py-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
        dragOver ? "border-[#C62828] bg-red-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <Upload size={32} className={`mx-auto mb-2 ${dragOver ? "text-[#C62828]" : "text-gray-300"}`} />
      <p className={`text-sm ${dragOver ? "text-[#C62828] font-medium" : "text-gray-400"}`}>{label}</p>
      <p className="text-xs text-gray-300 mt-1">PDF, DOCX, PPTX (máx. 100MB)</p>
    </div>
  );
}

function SilaboCard({ mat, onOpen }: { mat: Material; onOpen: (id: string) => void }) {
  return (
    <button onClick={() => onOpen(mat.id)}
      className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-[#C62828] hover:bg-red-50/30 transition-colors text-left">
      <div className="w-16 h-20 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 border border-gray-200">
        <FileText size={24} className="text-red-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{mat.nombre_archivo}</p>
        <p className="text-xs text-gray-400 mt-0.5">{formatSize(mat.tamano)} · {mat.tipo_archivo.toUpperCase()}</p>
        <p className="text-xs text-[#C62828] mt-1">Click para previsualizar →</p>
      </div>
    </button>
  );
}
