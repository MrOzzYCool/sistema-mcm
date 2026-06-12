"use client";

import { useEffect, useState, useRef } from "react";
import { getAccessToken } from "@/lib/get-token";
import { Course } from "@/types/course";
import CourseCard from "@/components/aula-virtual/CourseCard";
import WeeklyPanel from "@/components/aula-virtual/WeeklyPanel";
import { Loader2, GraduationCap } from "lucide-react";

export default function AulaVirtualDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [carrera, setCarrera] = useState<string | null>(null);
  const [ciclo, setCiclo] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    async function fetchMyCourses() {
      try {
        const token = await getAccessToken();
        if (!mountedRef.current) return;
        if (!token) { setError("Sesión no disponible"); setLoading(false); return; }

        const res = await fetch("/api/portal/mis-cursos-aula", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (!mountedRef.current) return;

        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Error al cargar cursos");
          setLoading(false);
          return;
        }

        setCourses(data.cursos ?? []);
        setCarrera(data.carrera ?? null);
        setCiclo(data.ciclo ?? null);
        setMessage(data.message ?? null);
      } catch (err: unknown) {
        if (mountedRef.current) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }
    fetchMyCourses();
    return () => { mountedRef.current = false; };
  }, []);

  return (
    <div className="py-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Mis Cursos</h1>
          {carrera && ciclo && (
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2">
              <GraduationCap size={14} />
              {carrera} — Ciclo {ciclo}
            </p>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 min-h-[calc(100vh-200px)]">
        <div className="min-w-0">
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
          {!loading && !error && courses.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[30vh] gap-2">
              <GraduationCap size={40} className="text-gray-300" />
              <p className="text-gray-500 text-center">
                {message ?? "No tienes cursos asignados para tu ciclo actual."}
              </p>
            </div>
          )}
          {!loading && !error && courses.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {courses.map((course) => (
                <CourseCard key={course.id} id={course.id} codigo={course.codigo}
                  nombre={course.nombre ?? course.nombre_curso} profesor={course.profesor}
                  progreso={course.progreso} modalidad={course.modalidad}
                  periodo={course.periodo} carrera={carrera} imagen_url={course.imagen_url} />
              ))}
            </div>
          )}
        </div>
        <div className="hidden lg:block"><WeeklyPanel /></div>
      </div>
    </div>
  );
}
