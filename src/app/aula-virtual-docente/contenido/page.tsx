"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/get-token";
import Link from "next/link";
import { Upload, Loader2, ArrowRight } from "lucide-react";

interface CursoBasico { id: string; curso_id?: string; nombre_curso: string; cycle_number?: number; }

export default function ContenidoDocentePage() {
  const [cursos, setCursos] = useState<CursoBasico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch("/api/portal/cursos-docente", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          const all = data.cursos ?? [];
          const seen = new Set<string>();
          setCursos(all.filter((c: CursoBasico) => {
            const key = c.curso_id ?? c.id;
            if (seen.has(key)) return false;
            seen.add(key); return true;
          }));
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  return (
    <div className="py-6 w-full max-w-3xl">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Gestión de Contenido</h1>
      <p className="text-sm text-gray-500 mb-6">Selecciona un curso para administrar su material semanal.</p>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin" /> Cargando cursos...
        </div>
      ) : cursos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 flex flex-col items-center justify-center min-h-[30vh]">
          <Upload size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500 text-center">No tienes cursos asignados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cursos.map(c => (
            <Link key={c.curso_id ?? c.id} href={`/aula-virtual-docente/curso/${c.curso_id ?? c.id}?tab=contenido`}
              className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Upload size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{c.nombre_curso}</p>
                  {c.cycle_number && <p className="text-xs text-gray-400">Ciclo {c.cycle_number}</p>}
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-300 group-hover:text-[#C62828] transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
