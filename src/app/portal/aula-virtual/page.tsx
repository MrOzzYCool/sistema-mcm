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
        const { data, error: fetchError } = await supabase
          .from("cursos")
          .select("*");

        if (fetchError) {
          setError(`Error al cargar cursos: ${fetchError.message}`);
        } else {
          setCourses(data ?? []);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, []);

  const periodos = useMemo(() => {
    const unique = Array.from(
      new Set(courses.map((c) => c.periodo).filter((p): p is string => !!p))
    ).sort().reverse();
    return unique;
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
    <div className="p-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-mcm-text">Aula Virtual</h1>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-mcm-text">Hola, {user?.name?.split(" ")[0]}</p>
            <p className="text-xs text-mcm-muted">Estudiante</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#a93526] flex items-center justify-center text-white font-bold text-sm">
            {user?.avatar ?? "?"}
          </div>
        </div>
      </div>

      {/* Banner */}
      <div className="w-full h-40 rounded-xl mb-5 overflow-hidden bg-gradient-to-r from-[#a93526] to-[#8a2b1f] flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold">Aula Virtual MCM</h2>
          <p className="text-sm text-white/80 mt-1">I.E.S. Privada Margarita Cabrera</p>
        </div>
      </div>

      {/* Main grid: courses + weekly panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 min-h-[calc(100vh-280px)]">
        <div className="min-w-0">
          {/* Filter */}
          {!loading && !error && courses.length > 0 && (
            <div className="flex items-center justify-end gap-2 mb-4">
              <span className="text-sm text-mcm-muted">Filtrar por:</span>
              <div className="relative">
                <select
                  value={selectedPeriodo}
                  onChange={(e) => setSelectedPeriodo(e.target.value)}
                  className="appearance-none text-sm border border-mcm-border rounded-md px-3 py-1.5 pr-8 bg-white text-mcm-text focus:outline-none focus:ring-2 focus:ring-[#a93526]/30 focus:border-[#a93526]"
                >
                  <option value="actual">Periodo actual</option>
                  <option value="todos">Todos los periodos</option>
                  {periodos.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-mcm-muted pointer-events-none" />
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center min-h-[30vh] gap-3 text-mcm-muted">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Cargando cursos...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3">
              <p className="text-mcm-muted text-lg">No se pudieron cargar los cursos.</p>
              <p className="text-red-500 text-sm font-mono max-w-md text-center">{error}</p>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filteredCourses.length === 0 && (
            <div className="flex items-center justify-center min-h-[30vh]">
              <p className="text-mcm-muted text-lg">No tienes cursos inscritos en este periodo.</p>
            </div>
          )}

          {/* Course grid */}
          {!loading && !error && filteredCourses.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {filteredCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  id={course.id}
                  codigo={course.codigo}
                  nombre={course.nombre ?? course.nombre_curso}
                  profesor={course.profesor}
                  progreso={course.progreso}
                  modalidad={course.modalidad}
                  periodo={course.periodo}
                  carrera={course.carrera}
                  imagen_url={course.imagen_url}
                />
              ))}
            </div>
          )}
        </div>

        {/* Weekly panel */}
        <div className="hidden lg:block">
          <WeeklyPanel />
        </div>
      </div>
    </div>
  );
}
