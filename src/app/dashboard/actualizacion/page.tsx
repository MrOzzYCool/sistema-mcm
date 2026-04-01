"use client";

import { useState, useEffect, useCallback } from "react";
import { getSolicitudes, actualizarEstado, borrarTodasLasSolicitudes } from "@/lib/solicitudes-service";
import { SolicitudDB } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import RouteGuard from "@/components/RouteGuard";
import {
  CheckCircle, XCircle, AlertTriangle, Eye, X,
  ExternalLink, RefreshCw, Loader2,
} from "lucide-react";
import clsx from "clsx";

type Estado = SolicitudDB["estado"];

const ESTADO_BADGE: Record<NonNullable<Estado>, string> = {
  pendiente: "badge-yellow", aprobado: "badge-green",
  observado: "badge-blue",  rechazado: "badge-red",
};
const ESTADO_LABEL: Record<NonNullable<Estado>, string> = {
  pendiente: "Pendiente", aprobado: "Aprobado",
  observado: "Observado", rechazado: "Rechazado",
};

function ActualizacionContent() {
  const { user } = useAuth();
  const esSuperAdmin = user?.role === "super_admin";

  const [solicitudes, setSolicitudes]   = useState<SolicitudDB[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [filtro, setFiltro]             = useState<Estado | "todos">("todos");
  const [lightbox, setLightbox]         = useState<{ url: string; titulo: string } | null>(null);
  const [modalObs, setModalObs]         = useState<SolicitudDB | null>(null);
  const [obsFields, setObsFields]       = useState({ voucher: "", dni_anverso: "", dni_reverso: "" });
  const [saving, setSaving]             = useState<string | null>(null);
  const [refreshKey, setRefreshKey]     = useState(0);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Carga solo tipo_formulario = 'actualizacion'
      const data = await getSolicitudes("actualizacion");
      setSolicitudes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar, refreshKey]);

  async function handleAprobar(id: string) {
    if (!id) return;
    setSaving(id);
    setError("");
    try {
      const res = await fetch("/api/solicitudes/aprobar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al aprobar");
      setSolicitudes((prev) =>
        prev.map((s) => s.id === id ? { ...s, estado: "aprobado" as const, pdf_boleta_url: json.pdfUrl } : s)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al aprobar");
    } finally {
      setSaving(null);
    }
  }

  async function handleRechazar() {
    if (!modalObs) return;
    setSaving(modalObs.id!);
    try {
      const res = await fetch("/api/solicitudes/rechazar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: modalObs.id, observaciones: obsFields }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSolicitudes((prev) =>
        prev.map((s) => s.id === modalObs.id ? { ...s, estado: "rechazado", observaciones: obsFields } : s)
      );
      setModalObs(null);
      setObsFields({ voucher: "", dni_anverso: "", dni_reverso: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al rechazar");
    } finally {
      setSaving(null);
    }
  }

  async function handleCambiarEstado(id: string, estado: NonNullable<Estado>) {
    setSaving(id);
    try {
      await actualizarEstado(id, estado);
      setSolicitudes((prev) => prev.map((s) => s.id === id ? { ...s, estado } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error actualizando estado");
    } finally {
      setSaving(null);
    }
  }

  const lista = filtro === "todos" ? solicitudes : solicitudes.filter((s) => s.estado === filtro);
  const kpis  = {
    todos:     solicitudes.length,
    pendiente: solicitudes.filter((s) => s.estado === "pendiente").length,
    aprobado:  solicitudes.filter((s) => s.estado === "aprobado").length,
    observado: solicitudes.filter((s) => s.estado === "observado").length,
  };

  return (
    <div className="p-6 w-full space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Actualización</h1>
          <p className="text-mcm-muted text-sm mt-0.5">Solicitudes de actualización — datos en tiempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}
            className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
          <a href="/actualizaciones" target="_blank" className="btn-secondary flex items-center gap-2 text-sm">
            <ExternalLink size={14} /> Formulario público
          </a>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["todos", "pendiente", "aprobado", "observado"] as const).map((e) => (
          <button key={e} onClick={() => setFiltro(e)}
            className={clsx("card text-left transition-all", filtro === e ? "ring-2 ring-[#a93526]" : "hover:shadow-md")}>
            <p className="text-xs text-mcm-muted capitalize">{e === "todos" ? "Total" : ESTADO_LABEL[e]}</p>
            <p className="text-2xl font-bold text-mcm-text mt-1">{kpis[e]}</p>
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Cargando...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Solicitante", "DNI", "Actualización", "Monto", "Fecha", "Docs", "Estado", "Acciones"].map((h) => (
                    <th key={h} className="text-left py-3.5 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((s) => (
                  <tr key={s.id} className="border-t border-mcm-border hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4">
                      <p className="font-semibold text-mcm-text">{s.nombres} {s.apellidos}</p>
                      <p className="text-xs text-mcm-muted">{s.email}</p>
                    </td>
                    <td className="py-4 px-4 font-mono text-sm text-mcm-text">{s.dni}</td>
                    <td className="py-4 px-4 text-xs text-mcm-text max-w-[200px]">{s.tipo_tramite}</td>
                    <td className="py-4 px-4 font-semibold text-mcm-text whitespace-nowrap">
                      {Number(s.monto_pagado) > 0 ? `S/ ${Number(s.monto_pagado).toLocaleString()}` : "—"}
                    </td>
                    <td className="py-4 px-4 text-mcm-muted text-xs whitespace-nowrap">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1.5">
                        <button onClick={() => setLightbox({ url: s.voucher_url, titulo: "Voucher" })}
                          className="flex items-center gap-1 text-xs text-[#a93526] hover:underline font-medium">
                          <Eye size={12} /> Voucher
                        </button>
                        <button onClick={() => setLightbox({ url: s.dni_anverso_url, titulo: "DNI ▲" })}
                          className="flex items-center gap-1 text-xs text-mcm-muted hover:text-mcm-text font-medium">
                          <Eye size={12} /> DNI ▲
                        </button>
                        <button onClick={() => setLightbox({ url: s.dni_reverso_url, titulo: "DNI ▼" })}
                          className="flex items-center gap-1 text-xs text-mcm-muted hover:text-mcm-text font-medium">
                          <Eye size={12} /> DNI ▼
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={ESTADO_BADGE[s.estado ?? "pendiente"]}>{ESTADO_LABEL[s.estado ?? "pendiente"]}</span>
                      {s.estado === "aprobado" && s.pdf_boleta_url && (
                        <a href={s.pdf_boleta_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-[#a93526] hover:underline font-medium mt-1">
                          <ExternalLink size={11} /> Comprobante
                        </a>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {saving === s.id ? (
                        <Loader2 size={14} className="animate-spin text-mcm-muted" />
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {s.estado !== "aprobado" && (
                            <button onClick={() => handleAprobar(s.id!)}
                              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium whitespace-nowrap">
                              <CheckCircle size={12} /> Aprobar
                            </button>
                          )}
                          {s.estado !== "observado" && (
                            <button onClick={() => handleCambiarEstado(s.id!, "observado")}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
                              <AlertTriangle size={12} /> Observar
                            </button>
                          )}
                          {s.estado !== "rechazado" && (
                            <button onClick={() => { setModalObs(s); setObsFields({ voucher: "", dni_anverso: "", dni_reverso: "" }); }}
                              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap">
                              <XCircle size={12} /> Rechazar
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-mcm-muted text-sm">
                      No hay solicitudes de actualización.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-white rounded-t-2xl px-5 py-3">
              <p className="font-semibold text-mcm-text">{lightbox.titulo}</p>
              <div className="flex items-center gap-3">
                <a href={lightbox.url} target="_blank" rel="noreferrer"
                  className="text-xs text-[#a93526] hover:underline flex items-center gap-1">
                  <ExternalLink size={12} /> Abrir
                </a>
                <button onClick={() => setLightbox(null)} className="text-mcm-muted hover:text-mcm-text">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="bg-slate-100 rounded-b-2xl overflow-hidden flex items-center justify-center min-h-64">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightbox.url} alt={lightbox.titulo} className="max-w-full max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Modal rechazo */}
      {modalObs && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
            <h3 className="font-bold text-mcm-text text-lg mb-1">Rechazar solicitud</h3>
            <p className="text-mcm-muted text-sm mb-5">
              Indica qué documentos tienen problemas para <strong>{modalObs.nombres} {modalObs.apellidos}</strong>.
            </p>
            <div className="space-y-4">
              {([
                { key: "voucher",     label: "Voucher de pago" },
                { key: "dni_anverso", label: "DNI — Anverso" },
                { key: "dni_reverso", label: "DNI — Reverso" },
              ] as const).map(({ key, label }) => (
                <div key={key}>
                  <label className="flex items-center gap-2 mb-1.5 cursor-pointer">
                    <input type="checkbox" checked={!!obsFields[key]}
                      onChange={(e) => setObsFields((p) => ({ ...p, [key]: e.target.checked ? "Documento no válido o ilegible" : "" }))}
                      className="w-4 h-4 accent-[#a93526]" />
                    <span className="text-sm font-medium text-mcm-text">{label}</span>
                  </label>
                  {obsFields[key] !== "" && (
                    <input type="text" value={obsFields[key]}
                      onChange={(e) => setObsFields((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder="Describe el problema..."
                      className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526] ml-6" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalObs(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleRechazar}
                disabled={!Object.values(obsFields).some(Boolean) || saving === modalObs.id}
                className="flex-1 text-sm text-white font-semibold px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving === modalObs.id && <Loader2 size={14} className="animate-spin" />}
                Confirmar Rechazo y Enviar Correo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActualizacionPage() {
  return (
    <RouteGuard allowedRoles={["super_admin", "actualizacion"]}>
      <ActualizacionContent />
    </RouteGuard>
  );
}
