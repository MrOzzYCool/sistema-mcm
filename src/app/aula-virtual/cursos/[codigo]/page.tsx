"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Course } from "@/types/course";
import {
  ArrowLeft, Video as VideoIcon, FileText, ExternalLink, LinkIcon,
  ChevronDown, ChevronUp, User, MonitorPlay, Upload, X, Clock,
  CheckCircle2, AlertCircle, MessageSquare, BookOpen, PenTool,
} from "lucide-react";

type TabId = "contenido" | "tareas" | "foros" | "notas" | "zoom";
const tabs: { id: TabId; label: string }[] = [
  { id: "contenido", label: "Contenido" },
  { id: "tareas", label: "Tareas" },
  { id: "foros", label: "Foros" },
  { id: "notas", label: "Notas" },
  { id: "zoom", label: "Zoom" },
];

interface ForoSemana { id: string; semana: number; titulo: string; estado: string; fecha_inicio: string | null; fecha_fin: string | null; }
interface MaterialSemana { id: string; semana: number; tipo: string; titulo: string; descripcion: string | null; url: string | null; estado_revision: string; fecha_limite: string | null; }
interface ActividadSemana { id: string; semana: number; titulo: string; tipo: string; url: string | null; estado: string; fecha_limite: string | null; }

function getCarreraSlug(carrera: string): string {
  const map: Record<string, string> = {
    "asistencia administrativa": "asistencia-administrativa",
    "gestión de recursos humanos": "recursos-humanos",
    "gestion de recursos humanos": "recursos-humanos",
    "recursos humanos": "recursos-humanos",
  };
  return map[carrera.toLowerCase().trim()] ?? carrera.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function getBannerUrl(course: { carrera?: string | null; imagen_url?: string | null }): string {
  if (course.imagen_url?.trim()) return course.imagen_url;
  if (course.carrera) return `/cursos/banner/${getCarreraSlug(course.carrera)}.jpg`;
  return `/cursos/banner/asistencia-administrativa.jpg`;
}

function getIconForType(tipo: string) {
  switch (tipo) {
    case "pdf": return <FileText size={16} className="text-red-500" />;
    case "video": return <VideoIcon size={16} className="text-blue-500" />;
    case "url": return <LinkIcon size={16} className="text-green-500" />;
    default: return <FileText size={16} className="text-gray-400" />;
  }
}

function EstadoBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    programado: "bg-blue-100 text-blue-700",
    activo: "bg-green-100 text-green-700",
    cerrado: "bg-gray-100 text-gray-600",
    no_revisado: "bg-yellow-100 text-yellow-700",
    revisado: "bg-green-100 text-green-700",
    entregado: "bg-green-100 text-green-700",
  };
  const labels: Record<string, string> = {
    programado: "Programado",
    activo: "Activo",
    cerrado: "Cerrado",
    no_revisado: "No revisado",
    revisado: "Revisado",
    entregado: "Entregado",
  };
  return (
    <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium ${styles[estado] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[estado] ?? estado}
    </span>
  );
}

function formatDate(d: string | null): string {
  if (!d) return "Sin fecha límite";
  try {
    return new Date(d).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return d; }
}

export default function CourseDetailPage() {
  const params = useParams();
  const codigo = params.codigo as string;
  const [course, setCourse] = useState<Course | null>(null);
  const [foros, setForos] = useState<ForoSemana[]>([]);
  const [materiales, setMateriales] = useState<MaterialSemana[]>([]);
  const [actividades, setActividades] = useState<ActividadSemana[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("contenido");
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set([1]));
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

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

        // Fetch all weekly data
        const [forosRes, matsRes, actsRes] = await Promise.all([
          supabase.from("foros_semana").select("*").eq("curso_id", courseData.id).order("semana"),
          supabase.from("materiales_semana").select("*").eq("curso_id", courseData.id).order("semana"),
          supabase.from("actividades_semana").select("*").eq("curso_id", courseData.id).order("semana"),
        ]);
        setForos(forosRes.data ?? []);
        setMateriales(matsRes.data ?? []);
        setActividades(actsRes.data ?? []);
      } catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [codigo]);

  const toggleWeek = (week: number) => {
    setOpenWeeks(prev => { const n = new Set(prev); if (n.has(week)) n.delete(week); else n.add(week); return n; });
  };
  const toggleSection = (key: string) => {
    setOpenSections(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-500 animate-pulse">Cargando curso...</p></div>;
  if (error || !course) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <p className="text-gray-500">{error || "Curso no encontrado"}</p>
      <Link href="/aula-virtual" className="text-[#C62828] hover:underline flex items-center gap-1"><ArrowLeft size={16} /> Volver</Link>
    </div>
  );

  const displayName = course.nombre ?? course.nombre_curso ?? "Curso";

  return (
    <div className="py-4 w-full max-w-[1200px] mx-auto">
      <Link href="/aula-virtual" className="inline-flex items-center gap-1 text-sm text-[#C62828] hover:underline mb-4">
        <ArrowLeft size={16} /> Volver a cursos
      </Link>

      {/* Banner */}
      <div className="relative rounded-xl overflow-hidden mb-6 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getBannerUrl(course)} alt={displayName} className="w-full h-48 lg:h-56 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-white drop-shadow-md">{displayName}</h1>
          <div className="flex items-center gap-2 mt-2 text-sm text-white/90"><User size={14} /><span>{course.profesor || "Docente no asignado"}</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm mb-6 overflow-x-auto">
        <div className="flex border-b border-gray-200 min-w-max">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? "text-[#C62828]" : "text-gray-500 hover:text-[#C62828]"}`}
              style={activeTab === tab.id ? { borderBottomWidth: "3px", borderBottomColor: "#C62828" } : {}}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Contenido — Acordeón semanal con 3 secciones */}
      {activeTab === "contenido" && (
        <div className="space-y-3">
          {Array.from({ length: 16 }, (_, i) => i + 1).map(week => {
            const isOpen = openWeeks.has(week);
            const weekForos = foros.filter(f => f.semana === week);
            const weekMats = materiales.filter(m => m.semana === week);
            const weekActs = actividades.filter(a => a.semana === week);
            const hasContent = weekForos.length > 0 || weekMats.length > 0 || weekActs.length > 0;

            return (
              <div key={week} className={`bg-white rounded-lg shadow-sm overflow-hidden ${isOpen ? "border-l-4 border-[#C62828]" : "border border-gray-200"}`}>
                <button onClick={() => toggleWeek(week)} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50">
                  <span className="font-medium text-gray-800 text-sm">Semana {week}</span>
                  <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100">
                    {!hasContent && (
                      <p className="text-sm text-gray-400 italic px-5 py-4">Contenido no disponible aún para esta semana.</p>
                    )}

                    {/* Sección: Foro de Consultas */}
                    {(weekForos.length > 0 || hasContent) && (
                      <div className="border-b border-gray-100">
                        <button onClick={() => toggleSection(`foro-${week}`)}
                          className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                            <MessageSquare size={16} className="text-blue-500" />
                            <span className="text-sm font-medium text-gray-700">Foro de Consultas - Semana {week}</span>
                          </div>
                          {openSections.has(`foro-${week}`) ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </button>
                        {openSections.has(`foro-${week}`) && (
                          <div className="px-5 pb-3">
                            {weekForos.length > 0 ? weekForos.map(foro => (
                              <div key={foro.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 mb-2">
                                <div className="flex items-center gap-3">
                                  <MessageSquare size={16} className="text-gray-400" />
                                  <div>
                                    <p className="text-xs text-gray-500">Foro de discusión no calificado</p>
                                    <p className="text-sm font-medium text-gray-700">{foro.titulo}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <EstadoBadge estado={foro.estado} />
                                  <div className="text-right text-[10px] text-gray-400">
                                    {foro.fecha_inicio && <p>Desde: {formatDate(foro.fecha_inicio)}</p>}
                                    {foro.fecha_fin && <p>Hasta: {formatDate(foro.fecha_fin)}</p>}
                                  </div>
                                </div>
                              </div>
                            )) : (
                              <p className="text-xs text-gray-400 italic py-2">Foro no disponible aún.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sección: Material de estudio */}
                    {(weekMats.length > 0 || hasContent) && (
                      <div className="border-b border-gray-100">
                        <button onClick={() => toggleSection(`mat-${week}`)}
                          className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                            <BookOpen size={16} className="text-green-500" />
                            <span className="text-sm font-medium text-gray-700">Material de estudio</span>
                          </div>
                          {openSections.has(`mat-${week}`) ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </button>
                        {openSections.has(`mat-${week}`) && (
                          <div className="px-5 pb-3 space-y-2">
                            {weekMats.length > 0 ? weekMats.map(mat => (
                              <div key={mat.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                                <div className="flex items-center gap-3">
                                  {getIconForType(mat.tipo)}
                                  <div>
                                    <p className="text-xs text-gray-500">Material - {mat.tipo.toUpperCase()}</p>
                                    <p className="text-sm font-medium text-gray-700">{mat.titulo}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <EstadoBadge estado={mat.estado_revision} />
                                  <span className="text-[10px] text-gray-400">{mat.fecha_limite ? formatDate(mat.fecha_limite) : "Sin fecha límite"}</span>
                                </div>
                              </div>
                            )) : (
                              <p className="text-xs text-gray-400 italic py-2">Sin material de estudio para esta semana.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sección: Pon en práctica lo aprendido */}
                    {weekActs.length > 0 && (
                      <div>
                        <button onClick={() => toggleSection(`act-${week}`)}
                          className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                            <PenTool size={16} className="text-orange-500" />
                            <span className="text-sm font-medium text-gray-700">Pon en práctica lo aprendido</span>
                          </div>
                          {openSections.has(`act-${week}`) ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </button>
                        {openSections.has(`act-${week}`) && (
                          <div className="px-5 pb-3 space-y-2">
                            {weekActs.map(act => (
                              <div key={act.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                                <div className="flex items-center gap-3">
                                  {getIconForType(act.tipo)}
                                  <div>
                                    <p className="text-xs text-gray-500">Material - {act.tipo.toUpperCase()}</p>
                                    <p className="text-sm font-medium text-gray-700">{act.titulo}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <EstadoBadge estado={act.estado} />
                                  <span className="text-[10px] text-gray-400">{act.fecha_limite ? formatDate(act.fecha_limite) : "Sin fecha límite"}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Other tabs */}
      {activeTab !== "contenido" && (
        <div className="bg-white rounded-xl shadow-sm p-12 flex items-center justify-center min-h-[200px]">
          <p className="text-gray-400 text-center">
            <span className="block text-lg font-medium text-gray-500 mb-1">{tabs.find(t => t.id === activeTab)?.label}</span>
            Disponible próximamente.
          </p>
        </div>
      )}
    </div>
  );
}
