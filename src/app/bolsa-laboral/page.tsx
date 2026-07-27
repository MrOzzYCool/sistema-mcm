"use client";

import { useState, useEffect, useCallback } from "react";
import { getAccessToken } from "@/lib/get-token";
import { OfertaLaboral } from "@/lib/bolsa-laboral/types";
import OfertaCard from "@/components/bolsa-laboral/OfertaCard";
import OfertaFilters from "@/components/bolsa-laboral/OfertaFilters";
import { Loader2, Briefcase } from "lucide-react";

export default function OfertasActivasPage() {
  const [ofertas, setOfertas] = useState<OfertaLaboral[]>([]);
  const [filteredOfertas, setFilteredOfertas] = useState<OfertaLaboral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOfertas = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión activa");
      const res = await fetch("/api/bolsa-laboral/ofertas/activas", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error al cargar ofertas");
      }
      const data: OfertaLaboral[] = await res.json();
      setOfertas(data);
      setFilteredOfertas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar ofertas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOfertas();
  }, [fetchOfertas]);

  const handleFilter = useCallback((filtered: OfertaLaboral[]) => {
    setFilteredOfertas(filtered);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
        <Loader2 size={24} className="animate-spin text-[#C62828]" />
        <span className="text-sm">Cargando ofertas...</span>
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
            onClick={fetchOfertas}
            className="mt-3 px-4 py-1.5 text-sm font-medium bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Ofertas laborales</h1>
        <p className="text-sm text-gray-500 mt-1">
          Explora las oportunidades disponibles y postúlate a las que se ajusten a tu perfil.
        </p>
      </div>

      {/* Filters */}
      <OfertaFilters ofertas={ofertas} onFilter={handleFilter} />

      {/* Offers grid or empty state */}
      {filteredOfertas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Briefcase size={28} className="text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium">No hay ofertas disponibles</p>
          <p className="text-sm text-gray-400 mt-1">
            {ofertas.length > 0
              ? "Intenta ajustar los filtros para ver más resultados."
              : "Aún no se han publicado ofertas laborales activas."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOfertas.map((oferta) => (
            <OfertaCard key={oferta.id} oferta={oferta} />
          ))}
        </div>
      )}
    </div>
  );
}
