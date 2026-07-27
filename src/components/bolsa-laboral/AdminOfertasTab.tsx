"use client";

import { useState, useEffect, useCallback } from "react";
import { getAccessToken } from "@/lib/get-token";
import { OfertaLaboral, EstadoOferta, ModalidadOferta } from "@/lib/bolsa-laboral/types";
import OfertaFormModal from "./OfertaFormModal";
import { Loader2, Plus, RefreshCw, Check, X, Lock, Pencil } from "lucide-react";
import clsx from "clsx";

interface AdminOfertasTabProps {
  onNavigatePostulaciones?: (ofertaId: string) => void;
}

const ESTADO_OPTIONS: { value: EstadoOferta | ""; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "pendiente", label: "Pendiente" },
  { value: "activa", label: "Activa" },
  { value: "cerrada", label: "Cerrada" },
  { value: "rechazada", label: "Rechazada" },
];

const MODALIDAD_OPTIONS: { value: ModalidadOferta | ""; label: string }[] = [
  { value: "", label: "Todas las modalidades" },
  { value: "presencial", label: "Presencial" },
  { value: "remoto", label: "Remoto" },
  { value: "hibrido", label: "Híbrido" },
];

function estadoBadgeClass(estado: EstadoOferta): string {
  switch (estado) {
    case "pendiente": return "badge-yellow";
    case "activa": return "badge-green";
    case "cerrada": return "badge-gray";
    case "rechazada": return "badge-red";
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

export default function AdminOfertasTab({ onNavigatePostulaciones }: AdminOfertasTabProps) {
  const [ofertas, setOfertas] = useState<OfertaLaboral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [filtroEstado, setFiltroEstado] = useState<EstadoOferta | "">("");
  const [filtroModalidad, setFiltroModalidad] = useState<ModalidadOferta | "">("");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editOferta, setEditOferta] = useState<OfertaLaboral | null>(null);

  const fetchOfertas = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión activa");
      const res = await fetch("/api/bolsa-laboral/ofertas", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al cargar ofertas");
      }
      const data: OfertaLaboral[] = await res.json();
      setOfertas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar ofertas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOfertas();
  }, [fetchOfertas]);

  async function handleAction(ofertaId: string, nuevoEstado: EstadoOferta) {
    setActionLoading(ofertaId);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión activa");
      const res = await fetch("/api/bolsa-laboral/ofertas", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: ofertaId, estado: nuevoEstado }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al actualizar oferta");
      }
      await fetchOfertas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setActionLoading(null);
    }
  }

  function handleEdit(oferta: OfertaLaboral) {
    setEditOferta(oferta);
    setModalOpen(true);
  }

  function handleCreate() {
    setEditOferta(null);
    setModalOpen(true);
  }

  function handleModalSuccess() {
    fetchOfertas();
  }

  function handlePostulacionesClick(ofertaId: string) {
    if (onNavigatePostulaciones) {
      onNavigatePostulaciones(ofertaId);
    }
  }

  // Apply filters
  const ofertasFiltradas = ofertas.filter((o) => {
    if (filtroEstado && o.estado !== filtroEstado) return false;
    if (filtroModalidad && o.modalidad !== filtroModalidad) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Estado filter */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoOferta | "")}
            className="border border-mcm-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none"
          >
            {ESTADO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Modalidad filter */}
          <select
            value={filtroModalidad}
            onChange={(e) => setFiltroModalidad(e.target.value as ModalidadOferta | "")}
            className="border border-mcm-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none"
          >
            {MODALIDAD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCreate}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={14} /> Crear oferta
          </button>
          <button
            onClick={fetchOfertas}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
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
            <span className="text-sm">Cargando ofertas...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Puesto", "Empresa", "Modalidad", "Estado", "Fecha publicación", "Postulaciones", "Acciones"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ofertasFiltradas.map((oferta) => (
                  <tr key={oferta.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-mcm-text">{oferta.puesto}</td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">{oferta.empresa_nombre}</td>
                    <td className="py-3 px-4">
                      <span className="badge-blue capitalize">{oferta.modalidad === "hibrido" ? "Híbrido" : oferta.modalidad}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={estadoBadgeClass(oferta.estado)} >{oferta.estado}</span>
                    </td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">
                      {formatFecha(oferta.fecha_publicacion)}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handlePostulacionesClick(oferta.id)}
                        className="text-[#C62828] hover:underline font-medium text-xs"
                        title="Ver postulaciones de esta oferta"
                      >
                        {oferta.postulaciones_count ?? 0}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {oferta.estado === "pendiente" && (
                          <>
                            <button
                              onClick={() => handleAction(oferta.id, "activa")}
                              disabled={actionLoading === oferta.id}
                              className={clsx(
                                "px-2 py-1 rounded text-xs font-medium transition-colors",
                                "bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                              )}
                              title="Aprobar oferta"
                            >
                              {actionLoading === oferta.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <span className="flex items-center gap-1"><Check size={12} /> Aprobar</span>
                              )}
                            </button>
                            <button
                              onClick={() => handleAction(oferta.id, "rechazada")}
                              disabled={actionLoading === oferta.id}
                              className={clsx(
                                "px-2 py-1 rounded text-xs font-medium transition-colors",
                                "bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                              )}
                              title="Rechazar oferta"
                            >
                              {actionLoading === oferta.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <span className="flex items-center gap-1"><X size={12} /> Rechazar</span>
                              )}
                            </button>
                          </>
                        )}
                        {oferta.estado === "activa" && (
                          <button
                            onClick={() => handleAction(oferta.id, "cerrada")}
                            disabled={actionLoading === oferta.id}
                            className={clsx(
                              "px-2 py-1 rounded text-xs font-medium transition-colors",
                              "bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                            )}
                            title="Cerrar oferta"
                          >
                            {actionLoading === oferta.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <span className="flex items-center gap-1"><Lock size={12} /> Cerrar</span>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(oferta)}
                          className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          title="Editar oferta"
                        >
                          <span className="flex items-center gap-1"><Pencil size={12} /> Editar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {ofertasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-mcm-muted text-sm">
                      {ofertas.length === 0
                        ? "No hay ofertas laborales registradas"
                        : "No hay ofertas que coincidan con los filtros seleccionados"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <OfertaFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditOferta(null);
        }}
        onSuccess={handleModalSuccess}
        editData={editOferta}
      />
    </div>
  );
}
