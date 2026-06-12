"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { getAccessToken } from "@/lib/get-token";
import { Course } from "@/types/course";
import CourseCard from "@/components/aula-virtual/CourseCard";
import { Loader2, GraduationCap, ChevronDown } from "lucide-react";

export default function DocenteDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCiclo, setSelectedCiclo] = useState<string>("todos");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    async function fetchCourses() {
      try {
        const token = await getAccessToken();
        if (!mountedRef.current || !token) return;

        const res = await fetch("/api/portal/cursos-docente", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!mountedRef.current) return;
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? "Error"); setLoading(false); return; }
        setCourses(data.cursos ?? []);
      } catch (err: unknown) {
        if (mountedRef.current) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }
    fetchCourses();
    return () => { mountedRef.current = false; };
  }, []);

  const ciclos = useMemo(() => {
    const unique = [...new Set(courses.map(c => c.ciclo_perteneciente))].sort();
    return unique;
  }, [courses]);

  const filteredCourses = useMemo(() => {
    if (selectedCiclo === "todos") return courses;
    return courses.filter(c => c.ciclo_perteneciente === Number(selectedCiclo));
  }, [courses, selectedCiclo]);

  return (
    <div className="py-4 w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Mis Cursos</h1>
          <p className="text-sm text-gray-500">{courses.length} cursos asignados</p>
        </div>
        {ciclos.length > 1 && (
          <div className="relative">
            <select value={selectedCiclo} onChange={(e) => setSelectedCiclo(e.target.value)}
              className="appearance-none text-sm border border-gray-300 rounded-md px-3 py-1.5 pr-8 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#C62828]/30">
              <option value="todos">Todos los ciclos</option>
              {ciclos.map(c => <option key={c} value={String(c)}>Ciclo {c}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center min-h-[30vh] gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin" /> <span className="text-sm">Cargando cursos...</span>
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}
      {!loading && !error && filteredCourses.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-2">
          <GraduationCap size={40} className="text-gray-300" />
          <p className="text-gray-500">No tienes cursos asignados.</p>
        </div>
      )}
      {!loading && !error && filteredCourses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} id={course.id} codigo={course.codigo}
              nombre={course.nombre ?? course.nombre_curso} profesor={null}
              progreso={null} modalidad={course.modalidad}
              periodo={`Ciclo ${course.ciclo_perteneciente}`} carrera={course.carrera} imagen_url={course.imagen_url}
              basePath="/aula-virtual-docente/curso" />
          ))}
        </div>
      )}
    </div>
  );
}
