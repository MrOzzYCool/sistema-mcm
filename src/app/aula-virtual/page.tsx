"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { getAccessToken } from "@/lib/get-token";
import { Course } from "@/types/course";
import CourseCard from "@/components/aula-virtual/CourseCard";
import WeeklyPanel from "@/components/aula-virtual/WeeklyPanel";
import { Loader2, GraduationCap } from "lucide-react";

export default function AulaVirtualDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [carrera, setCarrera] = useState<string | null>(null);
  const [ciclo, setCiclo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMyCourses() {
      try {
        const token = await getAccessToken();
        if (!token) { setError("Sesión no disponible"); setLoading(false); return; }

        // 1. Get alumno's inscription (carrera_id + ciclo_actual)
        const { data: { user: authUser } } = await supabase.auth.getUser(token);
        if (!authUser) { setError("No autenticado"); setLoading(false); return; }

        const { data: inscripcion } = await supabase
          .from("inscripciones")
          .select("carrera_id, ciclo_actual, carreras:carrera_id(nombre_carrera)")
          .eq("alumno_id", authUser.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!inscripcion || !inscripcion.carrera_id || !inscripcion.ciclo_actual) {
          setError("No se encontró inscripción activa");
          setLoading(false);
          return;
        }

        const carreraObj = inscripcion.carreras as unknown as { nombre_carrera?: string } | null;
        setCarrera(carreraObj?.nombre_carrera ?? null);
        setCiclo(inscripcion.ciclo_actual);

        // 2. Get curso_ids from malla_curricular for this carrera
        const { data: malla } = await supabase
          .from("malla_curricular")
          .select("curso_id")
          .eq("carrera_id", inscripcion.carrera_id);

        const cursoIds = (malla ?? []).map((m) => m.curso_id).filter(Boolean);

        if (cursoIds.length === 0) {
          setCourses([]);
          setLoading(false);
          return;
        }

        // 3. Get courses filtered by ciclo_perteneciente = ciclo_actual
        const { data: cursosData, error: cursosError } = await supabase
          .from("cursos")
          .select("*")
          .in("id", cursoIds)
          .eq("ciclo_perteneciente", inscripcion.ciclo_actual);

        if (cursosError) {
          setError(`Error al cargar cursos: ${cursosError.message}`);
        } else {
          setCourses(cursosData ?? []);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    fetchMyCourses();
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
              <p className="text-gray-500">No tienes cursos asignados para tu ciclo actual.</p>
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
