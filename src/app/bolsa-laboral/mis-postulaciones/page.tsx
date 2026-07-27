"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/get-token";
import { EstadoPostulacion } from "@/lib/bolsa-laboral/types";
import { Loader2, ClipboardList, ArrowRight } from "lucide-react";

/** Response shape from /api/bolsa-laboral/postulaciones for alumna_bolsa */
interface PostulacionItem {
  id: string;
  oferta_id: string;
  alumna_id: string;
  mensaje: string | null;
  cv_url: string | null;
  estado: EstadoPostulacion;
  created_at: string;
  ofertas_laborales: {
    puesto: string;
    empresa_nombre: string;
  } | null;
}

/** Color-coded badge for postulacion estado */
function EstadoBadge({ estado }: { estado: EstadoPostulacion }) {
  const config: Record<EstadoPostulacion, { label: string; bg: string; text: string }> = {
    enviada: { label: "Enviada", bg: "bg-blue-100", text: "text-blue-700" },
    vista: { label: "Vista", bg: "bg-yellow-100", text: "text-yellow-700" },
    seleccionada: { label: "Seleccionada", bg: "bg-green-100", text: "text-green-700" },
    descartada: { label: "Descartada", bg: "bg-red-100", text: "text-red-700" },
  };

  const { label, bg, text } = config[estado] ?? config.enviada;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

/** Format ISO date to DD/MM/YYYY */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function MisPostulacionesPage() {
  const [postulaciones, setPostulaciones] = useState<PostulacionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPostulaciones = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión activa");

      const res = await fetch("/api/bolsa-laboral/postulaciones", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error al cargar postulaciones");
      }

      const data: PostulacionItem[] = await res.json();
      setPostulaciones(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar postulaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPostulaciones();
  }, [fetchPostulaciones]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
        <Loader2 size={24} className="animate-spin text-[#C62828]" />
        <span className="text-sm">Cargando postulaciones...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm text-center">
          <p>{error}</p>
          <button
            onClick={fetchPostulaciones}
            className="mt-3 px-4 py-1.5 text-sm font-medium bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (postulaciones.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mis Postulaciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Aquí verás el historial y estado de tus postulaciones.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ClipboardList size={28} className="text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium">
            Aún no te has postulado a ninguna oferta
          </p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Explora las ofertas disponibles y postúlate a las que se ajusten a tu perfil.
          </p>
          <Link
            href="/bolsa-laboral"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#C62828] hover:bg-[#B71C1C] rounded-lg transition-colors"
          >
            Ver ofertas disponibles
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  // Postulaciones list
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mis Postulaciones</h1>
        <p className="text-sm text-gray-500 mt-1">
          Historial y estado actual de tus postulaciones.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {postulaciones.map((p) => (
          <Link
            key={p.id}
            href={`/bolsa-laboral/oferta/${p.oferta_id}`}
            className="flex items-center justify-between px-4 py-4 sm:px-6 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#C62828] transition-colors">
                {p.ofertas_laborales?.puesto ?? "Oferta eliminada"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {p.ofertas_laborales?.empresa_nombre ?? "—"}
              </p>
            </div>

            <div className="flex items-center gap-3 ml-4 shrink-0">
              <EstadoBadge estado={p.estado} />
              <span className="text-xs text-gray-400 hidden sm:inline">
                {formatDate(p.created_at)}
              </span>
              <ArrowRight size={16} className="text-gray-300 group-hover:text-[#C62828] transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
