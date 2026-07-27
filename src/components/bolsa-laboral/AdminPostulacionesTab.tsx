"use client";

import { useState, useEffect, useCallback } from "react";
import { getAccessToken } from "@/lib/get-token";
import { EstadoPostulacion } from "@/lib/bolsa-laboral/types";
import { Loader2, RefreshCw, Search, ArrowLeft, Download, X } from "lucide-react";
import clsx from "clsx";

interface PostulacionRow {
  id: string;
  oferta_id: string;
  alumna_id: string;
  mensaje: string | null;
  cv_url: string | null;
  estado: EstadoPostulacion;
  created_at: string;
  ofertas_laborales: { puesto: string; empresa_nombre: string } | null;
  profiles: { nombre: string } | null;
}

interface AdminPostulacionesTabProps {
  filterOfertaId?: string | null;
  onClearFilter?: () => void;
}

const ESTADO_OPTIONS: { value: EstadoPostulacion | ""; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "enviada", label: "Enviada" },
  { value: "vista", label: "Vista" },
  { value: "seleccionada", label: "Seleccionada" },
  { value: "descartada", label: "Descartada" },
];

const ESTADO_CHANGE_OPTIONS: { value: EstadoPostulacion; label: string }[] = [
  { value: "vista", label: "Vista" },
  { value: "seleccionada", label: "Seleccionada" },
  { value: "descartada", label: "Descartada" },
];

function estadoBadgeClass(estado: EstadoPostulacion): string {
  switch (estado) {
    case "enviada": return "badge-blue";
    case "vista": return "badge-yellow";
    case "seleccionada": return "badge-green";
    case "descartada": return "badge-red";
    default: return "badge-gray";
  }
}

function formatFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function AdminPostulacionesTab({ filterOfertaId, onClearFilter }: AdminPostulacionesTabProps) {
  const [postulaciones, setPostulaciones] = useState<PostulacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [filtroEstado, setFiltroEstado] = useState<EstadoPostulacion | "">("");
  const [searchTerm, setSearchTerm] = useState("");

  // Detail view
  const [selectedPostulacion, setSelectedPostulacion] = useState<PostulacionRow | null>(null);

  const fetchPostulaciones = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión activa");

      let url = "/api/bolsa-laboral/postulaciones";
      if (filterOfertaId) {
        url += `?oferta_id=${filterOfertaId}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al cargar postulaciones");
      }
      const data: PostulacionRow[] = await res.json();
      setPostulaciones(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar postulaciones");
    } finally {
      setLoading(false);
    }
  }, [filterOfertaId]);

  useEffect(() => {
    fetchPostulaciones();
  }, [fetchPostulaciones]);

  async function handleEstadoChange(postulacionId: string, nuevoEstado: EstadoPostulacion) {
    setActionLoading(postulacionId);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión activa");
      const res = await fetch("/api/bolsa-laboral/postulaciones", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: postulacionId, estado: nuevoEstado }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al actualizar estado");
      }
      await fetchPostulaciones();
      // Update selected postulacion if open
      if (selectedPostulacion?.id === postulacionId) {
        setSelectedPostulacion((prev) =>
          prev ? { ...prev, estado: nuevoEstado } : null
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setActionLoading(null);
    }
  }

  // Apply filters
  const postulacionesFiltradas = postulaciones.filter((p) => {
    if (filtroEstado && p.estado !== filtroEstado) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const alumnaName = (p.profiles?.nombre ?? "").toLowerCase();
      const puesto = (p.ofertas_laborales?.puesto ?? "").toLowerCase();
      if (!alumnaName.includes(term) && !puesto.includes(term)) return false;
    }
    return true;
  });

  // Detail view
  if (selectedPostulacion) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedPostulacion(null)}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <ArrowLeft size={14} /> Volver al listado
        </button>

        <div className="card p-6 space-y-4">
          <h3 className="text-lg font-bold text-mcm-text">Detalle de Postulación</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-mcm-muted font-medium uppercase tracking-wide mb-1">Alumna</p>
              <p className="text-sm text-mcm-text font-medium">
                {selectedPostulacion.profiles?.nombre ?? "Sin nombre"}
              </p>
            </div>
            <div>
              <p className="text-xs text-mcm-muted font-medium uppercase tracking-wide mb-1">Estado</p>
              <span className={estadoBadgeClass(selectedPostulacion.estado)}>
                {selectedPostulacion.estado}
              </span>
            </div>
            <div>
              <p className="text-xs text-mcm-muted font-medium uppercase tracking-wide mb-1">Puesto</p>
              <p className="text-sm text-mcm-text">
                {selectedPostulacion.ofertas_laborales?.puesto ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-mcm-muted font-medium uppercase tracking-wide mb-1">Empresa</p>
              <p className="text-sm text-mcm-text">
                {selectedPostulacion.ofertas_laborales?.empresa_nombre ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-mcm-muted font-medium uppercase tracking-wide mb-1">Fecha de postulación</p>
              <p className="text-sm text-mcm-text">{formatFecha(selectedPostulacion.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-mcm-muted font-medium uppercase tracking-wide mb-1">CV</p>
              {selectedPostulacion.cv_url ? (
                <a
                  href={selectedPostulacion.cv_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[#C62828] hover:underline font-medium"
                >
                  <Download size={14} /> Descargar CV
                </a>
              ) : (
                <p className="text-sm text-mcm-muted">No adjuntó CV</p>
              )}
            </div>
          </div>

          {/* Mensaje */}
          <div>
            <p className="text-xs text-mcm-muted font-medium uppercase tracking-wide mb-1">Mensaje / Carta de presentación</p>
            <div className="bg-slate-50 border border-mcm-border rounded-lg p-3">
              <p className="text-sm text-mcm-text whitespace-pre-wrap">
                {selectedPostulacion.mensaje || "Sin mensaje"}
              </p>
            </div>
          </div>

          {/* Cambiar estado */}
          <div className="border-t border-mcm-border pt-4">
            <p className="text-xs text-mcm-muted font-medium uppercase tracking-wide mb-2">Cambiar estado</p>
            <div className="flex items-center gap-2 flex-wrap">
              {ESTADO_CHANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleEstadoChange(selectedPostulacion.id, opt.value)}
                  disabled={actionLoading === selectedPostulacion.id || selectedPostulacion.estado === opt.value}
                  className={clsx(
                    "px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50",
                    selectedPostulacion.estado === opt.value
                      ? "bg-slate-200 text-slate-500 cursor-default"
                      : opt.value === "seleccionada"
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : opt.value === "descartada"
                          ? "bg-red-100 text-red-700 hover:bg-red-200"
                          : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                  )}
                >
                  {actionLoading === selectedPostulacion.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    opt.label
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Estado filter */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoPostulacion | "")}
            className="border border-mcm-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none"
          >
            {ESTADO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Search input */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mcm-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por puesto o alumna..."
              className="border border-mcm-border rounded-lg pl-8 pr-3 py-1.5 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none w-64"
            />
          </div>

          {/* Active oferta filter indicator */}
          {filterOfertaId && (
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-blue-700 font-medium">
              <span>Filtrado por oferta</span>
              {onClearFilter && (
                <button onClick={onClearFilter} className="hover:text-blue-900">
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        <button
          onClick={fetchPostulaciones}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Cargando postulaciones...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Alumna", "Puesto", "Empresa", "Estado", "Fecha", "Acciones"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {postulacionesFiltradas.map((post) => (
                  <tr key={post.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-mcm-text">
                      {post.profiles?.nombre ?? "Sin nombre"}
                    </td>
                    <td className="py-3 px-4 text-mcm-text text-xs">
                      {post.ofertas_laborales?.puesto ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">
                      {post.ofertas_laborales?.empresa_nombre ?? "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span className={estadoBadgeClass(post.estado)}>{post.estado}</span>
                    </td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">
                      {formatFecha(post.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => setSelectedPostulacion(post)}
                          className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          Ver detalle
                        </button>
                        <select
                          value={post.estado}
                          onChange={(e) => handleEstadoChange(post.id, e.target.value as EstadoPostulacion)}
                          disabled={actionLoading === post.id}
                          className="border border-mcm-border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#C62828] focus:outline-none disabled:opacity-50"
                        >
                          <option value="enviada" disabled>Enviada</option>
                          <option value="vista">Vista</option>
                          <option value="seleccionada">Seleccionada</option>
                          <option value="descartada">Descartada</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
                {postulacionesFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-mcm-muted text-sm">
                      {postulaciones.length === 0
                        ? "No hay postulaciones registradas"
                        : "No hay postulaciones que coincidan con los filtros seleccionados"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
