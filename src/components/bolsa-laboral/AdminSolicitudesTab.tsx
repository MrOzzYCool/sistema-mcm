"use client";

import { useState, useEffect, useCallback } from "react";
import { getAccessToken } from "@/lib/get-token";
import { SolicitudAcceso, EstadoSolicitud } from "@/lib/bolsa-laboral/types";
import { Loader2, RefreshCw, Check, X } from "lucide-react";
import clsx from "clsx";

interface AdminSolicitudesTabProps {
  onCountChange?: () => void;
}

const ESTADO_OPTIONS: { value: EstadoSolicitud | ""; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "pendiente", label: "Pendiente" },
  { value: "aprobada", label: "Aprobada" },
  { value: "rechazada", label: "Rechazada" },
];

function estadoBadgeClass(estado: EstadoSolicitud): string {
  switch (estado) {
    case "pendiente": return "badge-yellow";
    case "aprobada": return "badge-green";
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

export default function AdminSolicitudesTab({ onCountChange }: AdminSolicitudesTabProps) {
  const [solicitudes, setSolicitudes] = useState<SolicitudAcceso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [filtroEstado, setFiltroEstado] = useState<EstadoSolicitud | "">("");

  // Rechazar modal state
  const [rechazarId, setRechazarId] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [motivoError, setMotivoError] = useState("");

  const fetchSolicitudes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión activa");
      const res = await fetch("/api/bolsa-laboral/solicitudes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al cargar solicitudes");
      }
      const data: SolicitudAcceso[] = await res.json();
      setSolicitudes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSolicitudes();
  }, [fetchSolicitudes]);

  async function handleAprobar(solicitudId: string) {
    setActionLoading(solicitudId);
    setError("");
    setSuccessMsg("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión activa");
      const res = await fetch("/api/bolsa-laboral/solicitudes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: solicitudId, action: "aprobar" }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(data.error ?? "El email ya está registrado en el sistema");
        }
        throw new Error(data.error ?? "Error al aprobar solicitud");
      }

      // Check if email failed (warning with tempPassword)
      if (data.warning && data.tempPassword) {
        setSuccessMsg(
          `Solicitud aprobada. ⚠️ No se pudo enviar el email. Contraseña temporal: ${data.tempPassword}`
        );
      } else {
        setSuccessMsg("Solicitud aprobada exitosamente. Se envió email con credenciales.");
      }

      await fetchSolicitudes();
      onCountChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al aprobar");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRechazar() {
    if (!rechazarId) return;
    if (!motivoRechazo.trim()) {
      setMotivoError("El motivo de rechazo es requerido");
      return;
    }

    setActionLoading(rechazarId);
    setError("");
    setSuccessMsg("");
    setMotivoError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión activa");
      const res = await fetch("/api/bolsa-laboral/solicitudes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: rechazarId,
          action: "rechazar",
          motivo_rechazo: motivoRechazo.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al rechazar solicitud");
      }

      setSuccessMsg("Solicitud rechazada.");
      setRechazarId(null);
      setMotivoRechazo("");
      await fetchSolicitudes();
      onCountChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al rechazar");
    } finally {
      setActionLoading(null);
    }
  }

  function openRechazarModal(solicitudId: string) {
    setRechazarId(solicitudId);
    setMotivoRechazo("");
    setMotivoError("");
  }

  function closeRechazarModal() {
    setRechazarId(null);
    setMotivoRechazo("");
    setMotivoError("");
  }

  // Apply filters
  const solicitudesFiltradas = solicitudes.filter((s) => {
    if (filtroEstado && s.estado !== filtroEstado) return false;
    return true;
  });

  // Pending count
  const pendienteCount = solicitudes.filter((s) => s.estado === "pendiente").length;

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Estado filter */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoSolicitud | "")}
            className="border border-mcm-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none"
          >
            {ESTADO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Pending count badge */}
          {pendienteCount > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pendienteCount} pendiente{pendienteCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSolicitudes}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">
          {successMsg}
        </div>
      )}

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
            <span className="text-sm">Cargando solicitudes...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Nombre", "DNI", "Carrera", "Año Egreso", "Estado", "Fecha", "Acciones"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {solicitudesFiltradas.map((solicitud) => (
                  <tr key={solicitud.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-mcm-text">{solicitud.alumna_nombre}</td>
                    <td className="py-3 px-4 text-mcm-muted text-xs font-mono">{solicitud.alumna_dni}</td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">{solicitud.carrera}</td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">{solicitud.anio_egreso}</td>
                    <td className="py-3 px-4">
                      <span className={estadoBadgeClass(solicitud.estado)}>{solicitud.estado}</span>
                    </td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">
                      {formatFecha(solicitud.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {solicitud.estado === "pendiente" && (
                          <>
                            <button
                              onClick={() => handleAprobar(solicitud.id)}
                              disabled={actionLoading === solicitud.id}
                              className={clsx(
                                "px-2 py-1 rounded text-xs font-medium transition-colors",
                                "bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                              )}
                              title="Aprobar solicitud"
                            >
                              {actionLoading === solicitud.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <span className="flex items-center gap-1"><Check size={12} /> Aprobar</span>
                              )}
                            </button>
                            <button
                              onClick={() => openRechazarModal(solicitud.id)}
                              disabled={actionLoading === solicitud.id}
                              className={clsx(
                                "px-2 py-1 rounded text-xs font-medium transition-colors",
                                "bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                              )}
                              title="Rechazar solicitud"
                            >
                              <span className="flex items-center gap-1"><X size={12} /> Rechazar</span>
                            </button>
                          </>
                        )}
                        {solicitud.estado === "rechazada" && solicitud.motivo_rechazo && (
                          <span className="text-xs text-mcm-muted italic truncate max-w-[200px]" title={solicitud.motivo_rechazo}>
                            Motivo: {solicitud.motivo_rechazo}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {solicitudesFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-mcm-muted text-sm">
                      {solicitudes.length === 0
                        ? "No hay solicitudes de acceso registradas"
                        : "No hay solicitudes que coincidan con el filtro seleccionado"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rechazar Modal */}
      {rechazarId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-mcm-text">Rechazar solicitud</h3>
            <p className="text-sm text-mcm-muted">
              Ingrese el motivo de rechazo. Este será visible para el administrador.
            </p>
            <div>
              <textarea
                value={motivoRechazo}
                onChange={(e) => {
                  setMotivoRechazo(e.target.value);
                  if (motivoError) setMotivoError("");
                }}
                placeholder="Motivo de rechazo..."
                rows={3}
                className={clsx(
                  "w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none resize-none",
                  motivoError ? "border-red-400" : "border-mcm-border"
                )}
              />
              {motivoError && (
                <p className="text-red-600 text-xs mt-1">{motivoError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={closeRechazarModal}
                className="btn-secondary text-sm"
                disabled={actionLoading === rechazarId}
              >
                Cancelar
              </button>
              <button
                onClick={handleRechazar}
                disabled={actionLoading === rechazarId}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading === rechazarId ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <X size={14} />
                )}
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
