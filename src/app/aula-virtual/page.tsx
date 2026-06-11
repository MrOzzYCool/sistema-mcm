"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Course } from "@/types/course";
import CourseCard from "@/components/aula-virtual/CourseCard";
import WeeklyPanel from "@/components/aula-virtual/WeeklyPanel";
import { ChevronDown, Loader2 } from "lucide-react";

export default function AulaVirtualDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>("actual");

  useEffect(() => {
    async function fetchCourses() {
      try {
        const { data, error: fetchError } = await supabase.from("cursos").select("*");
        if (fetchError) setError(`Error al cargar cursos: ${fetchError.message}`);
        else setCourses(data ?? []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally { setLoading(false); }
    }
    fetchCourses();
  }, []);

  const periodos = useMemo(() => {
    return Array.from(new Set(courses.map((c) => c.periodo).filter((p): p is string => !!p))).sort().reverse();
  }, [courses]);

  const periodoActual = periodos[0] || null;

  const filteredCourses = useMemo(() => {
    if (selectedPeriodo === "todos") return courses;
    if (selectedPeriodo === "actual") {
      if (!periodoActual) return courses;
      return courses.filter((c) => c.periodo === periodoActual);
    }
    return courses.filter((c) => c.periodo === selectedPeriodo);
  }, [courses, selectedPeriodo, periodoActual]);

  return (
    <div className="py-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Mis Cursos</h1>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 min-h-[calc(100vh-300px)]">
        <div className="min-w-0">
          {/* Filter */}
          {!loading && !error && courses.length > 0 && (
            <div className="flex items-center justify-end gap-2 mb-4">
              <span className="text-sm text-gray-500">Filtrar por:</span>
              <div className="relative">
                <select value={selectedPeriodo} onChange={(e) => setSelectedPeriodo(e.target.value)}
                  className="appearance-none text-sm border border-gray-300 rounded-md px-3 py-1.5 pr-8 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-400/30">
                  <option value="actual">Periodo actual</option>
                  <option value="todos">Todos los periodos</option>
                  {periodos.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center min-h-[30vh] gap-3 text-gray-400">
              <Loader2 size={20} className="animate-spin" /> <span className="text-sm">Cargando cursos...</span>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3">
              <p className="text-gray-500">No se pudieron cargar los cursos.</p>
              <p className="text-red-500 text-sm font-mono max-w-md text-center">{error}</p>
            </div>
          )}
          {!loading && !error && filteredCourses.length === 0 && (
            <div className="flex items-center justify-center min-h-[30vh]">
              <p className="text-gray-500">No tienes cursos inscritos en este periodo.</p>
            </div>
          )}
          {!loading && !error && filteredCourses.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {filteredCourses.map((course) => (
                <CourseCard key={course.id} id={course.id} codigo={course.codigo}
                  nombre={course.nombre ?? course.nombre_curso} profesor={course.profesor}
                  progreso={course.progreso} modalidad={course.modalidad}
                  periodo={course.periodo} carrera={course.carrera} imagen_url={course.imagen_url} />
              ))}
            </div>
          )}
        </div>
        <div className="hidden lg:block"><WeeklyPanel /></div>
      </div>
    </div>
  );
}
