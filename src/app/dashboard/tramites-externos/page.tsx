"use client";

import { useState, useEffect, useCallback } from "react";
import { getSolicitudes, actualizarEstado, getPublicUrl, borrarTodasLasSolicitudes } from "@/lib/solicitudes-service";
import { SolicitudDB } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import RouteGuard from "@/components/RouteGuard";
import { CheckCircle, XCircle, AlertTriangle, Eye, X, ExternalLink, RefreshCw, Loader2, Trash2 } from "lucide-react";
import clsx from "clsx";

type Estado = SolicitudDB["estado"];

const ESTADO_BADGE: Record<NonNullable<Estado>, string> = {
  pendiente:  "badge-yellow",
  aprobado:   "badge-green",
  observado:  "badge-blue",
  rechazado:  "badge-red",
};
const ESTADO_LABEL: Record<NonNullable<Estado>, string> = {
  pendiente: "Pendiente", aprobado: "Aprobado",
  observado: "Observado", rechazado: "Rechazado",
};

export default function TramitesExternosAdminPage() {
  return (
    <RouteGuard allowedRoles={["super_admin", "staff_tramites", "gestor"]}>
      <TramitesExternosContent />
    </RouteGuard>
  );
}

function TramitesExternosContent() {
  const { user } = useAuth();
  const esSuperAdmin = user?.role === "super_admin";
  const [solicitudes, setSolicitudes]   = useState<SolicitudDB[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [filtro, setFiltro]             = useState<Estado | "todos">("todos");
  const [lightbox, setLightbox]         = useState<{ url: string; titulo: string } | null>(null);
  const [modalObs, setModalObs]         = useState<SolicitudDB | null>(null);
  const [observacion, setObservacion]   = useState("");
  const [obsFields, setObsFields]       = useState({ voucher: "", dni_anverso: "", dni_reverso: "" });
  const [saving, setSaving]             = useState<string | null>(null);
  const [showLimpiar, setShowLimpiar]   = useState(false);
  const [limpiando, setLimpiando]       = useState(false);
  const [refreshKey, setRefreshKey]     = useState(0); // incrementar fuerza re-fetch

  // ─── Cargar desde Supabase ─────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getSolicitudes("tramite");
      setSolicitudes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando solicitudes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar, refreshKey]);

  async function handleLimpiar() {
    setLimpiando(true);
    try {
      await borrarTodasLasSolicitudes();
      setSolicitudes([]);
      setShowLimpiar(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al limpiar");
    } finally {
      setLimpiando(false);
    }
  }

  // ─── Cambiar estado en Supabase ────────────────────────────────────────────

  async function handleCambiarEstado(id: string, estado: NonNullable<Estado>, obs?: string) {
    setSaving(id);
    try {
      await actualizarEstado(id, estado, obs);
      setSolicitudes((prev) =>
        prev.map((s) => s.id === id ? { ...s, estado, observacion: obs ?? s.observacion } : s)
      );
      setModalObs(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error actualizando estado");
    } finally {
      setSaving(null);
    }
  }

  async function handleEliminar(id: string, nombre: string) {
    if (!confirm(`¿Estás seguro de eliminar el trámite de "${nombre}"?\n\nEsta acción no se puede deshacer.`)) return;
    setSaving(id);
    try {
      const { supabase: sb } = await import("@/lib/supabase");
      const { error: delErr } = await sb.from("solicitudes").delete().eq("id", id);
      if (delErr) throw new Error(delErr.message);
      setSolicitudes((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error eliminando trámite");
    } finally {
      setSaving(null);
    }
  }

  async function handleAprobar(id: string) {
    if (!id) { setError("ID de solicitud inválido"); return; }
    setSaving(id);
    setError("");
    try {
      console.log("[handleAprobar] llamando a /api/solicitudes/aprobar con id:", id);
      const res = await fetch("/api/solicitudes/aprobar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id }),
      });
      const json = await res.json();
      console.log("[handleAprobar] respuesta:", res.status, json);
      if (!res.ok) throw new Error(json.error ?? "Error al aprobar");

      setSolicitudes((prev) =>
        prev.map((s) => s.id === id
          ? { ...s, estado: "aprobado" as const, pdf_boleta_url: json.pdfUrl }
          : s
        )
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
        prev.map((s) => s.id === modalObs.id
          ? { ...s, estado: "rechazado", observaciones: obsFields }
          : s
        )
      );
      setModalObs(null);
      setObsFields({ voucher: "", dni_anverso: "", dni_reverso: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al rechazar");
    } finally {
      setSaving(null);
    }
  }

  // ─── Filtrado ──────────────────────────────────────────────────────────────

  const lista = filtro === "todos"
    ? solicitudes
    : solicitudes.filter((s) => s.estado === filtro);

  // ─── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = {
    todos:     solicitudes.length,
    pendiente: solicitudes.filter((s) => s.estado === "pendiente").length,
    aprobado:  solicitudes.filter((s) => s.estado === "aprobado").length,
    observado: solicitudes.filter((s) => s.estado === "observado").length,
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 w-full space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Trámites Externos</h1>
          <p className="text-mcm-muted text-sm mt-0.5">Solicitudes de exalumnas — datos en tiempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRefreshKey(k => k + 1)} disabled={loading}
            className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
          {esSuperAdmin && (
            <button
              onClick={() => setShowLimpiar(true)}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium"
            >
              🗑 Limpiar pruebas
            </button>
          )}
          <a href="/tramites-externos" target="_blank"
            className="btn-secondary flex items-center gap-2 text-sm">
            <ExternalLink size={14} /> Formulario público
          </a>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {/* KPI cards / filtros */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["todos", "pendiente", "aprobado", "observado"] as const).map((e) => (
          <button key={e} onClick={() => setFiltro(e)}
            className={clsx("card text-left transition-all", filtro === e ? "ring-2 ring-[#a93526]" : "hover:shadow-md")}>
            <p className="text-xs text-mcm-muted capitalize">{e === "todos" ? "Total" : ESTADO_LABEL[e]}</p>
            <p className="text-2xl font-bold text-mcm-text mt-1">{kpis[e]}</p>
          </button>
        ))}
      </div>

      {/* Tabla — full width, sin max-w */}
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
                  <th className="text-left py-3.5 px-5 text-mcm-muted font-medium text-xs uppercase tracking-wide w-[22%]">Solicitante</th>
                  <th className="text-left py-3.5 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide w-[8%]">DNI</th>
                  <th className="text-left py-3.5 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide w-[28%]">Trámite</th>
                  <th className="text-left py-3.5 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide w-[8%]">Monto</th>
                  <th className="text-left py-3.5 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide w-[9%]">Fecha</th>
                  <th className="text-left py-3.5 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide w-[8%]">Docs</th>
                  <th className="text-left py-3.5 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide w-[8%]">Estado</th>
                  <th className="text-left py-3.5 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide w-[9%]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((s) => (
                  <tr key={s.id} className="border-t border-mcm-border hover:bg-slate-50 transition-colors">

                    {/* Solicitante */}
                    <td className="py-4 px-5">
                      <p className="font-semibold text-mcm-text leading-tight">{s.nombres} {s.apellidos}</p>
                      <p className="text-xs text-mcm-muted mt-0.5">{s.email}</p>
                      <p className="text-xs text-mcm-muted">{s.celular}</p>
                    </td>

                    {/* DNI */}
                    <td className="py-4 px-4 text-mcm-text font-mono text-sm font-medium whitespace-nowrap">{s.dni}</td>

                    {/* Trámite */}
                    <td className="py-4 px-4">
                      <p className="text-mcm-text text-xs leading-snug">{s.tipo_tramite}</p>
                      <p className="text-xs text-mcm-muted mt-1">Egreso: {s.anio_egreso}</p>
                    </td>

                    {/* Monto */}
                    <td className="py-4 px-4 font-semibold text-mcm-text whitespace-nowrap">
                      {s.monto_pagado > 0 ? `S/ ${Number(s.monto_pagado).toLocaleString()}` : <span className="text-mcm-muted font-normal">—</span>}
                    </td>

                    {/* Fecha */}
                    <td className="py-4 px-4 text-mcm-muted whitespace-nowrap text-xs">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString("es-PE", {
                        day: "2-digit", month: "short", year: "numeric",
                      }) : "—"}
                    </td>

                    {/* Documentos */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1.5">
                        <button onClick={() => setLightbox({ url: s.voucher_url, titulo: "Voucher de pago" })}
                          className="flex items-center gap-1 text-xs text-[#a93526] hover:underline font-medium whitespace-nowrap">
                          <Eye size={12} /> Voucher
                        </button>
                        <button onClick={() => setLightbox({ url: s.dni_anverso_url, titulo: "DNI — Anverso" })}
                          className="flex items-center gap-1 text-xs text-mcm-muted hover:text-mcm-text font-medium whitespace-nowrap">
                          <Eye size={12} /> DNI ▲
                        </button>
                        <button onClick={() => setLightbox({ url: s.dni_reverso_url, titulo: "DNI — Reverso" })}
                          className="flex items-center gap-1 text-xs text-mcm-muted hover:text-mcm-text font-medium whitespace-nowrap">
                          <Eye size={12} /> DNI ▼
                        </button>
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="py-4 px-4">
                      <span className={ESTADO_BADGE[s.estado ?? "pendiente"]}>
                        {ESTADO_LABEL[s.estado ?? "pendiente"]}
                      </span>
                      {s.observacion && (
                        <p className="text-xs text-mcm-muted mt-1.5 max-w-[120px] truncate" title={s.observacion}>
                          {s.observacion}
                        </p>
                      )}
                    </td>

                    {/* Acciones */}
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
                          {s.estado === "aprobado" && s.pdf_boleta_url && (
                            <a href={s.pdf_boleta_url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-[#a93526] hover:underline font-medium whitespace-nowrap">
                              <ExternalLink size={12} /> Comprobante
                            </a>
                          )}
                          {s.estado !== "observado" && (
                            <button onClick={() => handleCambiarEstado(s.id!, "observado")}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
                              <AlertTriangle size={12} /> Observar
                            </button>
                          )}
                          {s.estado !== "rechazado" && (
                            <button onClick={() => { setModalObs(s); setObservacion(""); setObsFields({ voucher: "", dni_anverso: "", dni_reverso: "" }); }}
                              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap">
                              <XCircle size={12} /> Rechazar
                            </button>
                          )}
                          {esSuperAdmin && (
                            <button onClick={() => handleEliminar(s.id!, `${s.nombres} ${s.apellidos}`)}
                              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-700 font-medium whitespace-nowrap mt-1">
                              <Trash2 size={12} /> Eliminar
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
                      No hay solicitudes {filtro !== "todos" ? `con estado "${ESTADO_LABEL[filtro as NonNullable<Estado>]}"` : ""}.
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
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-white rounded-t-2xl px-5 py-3">
              <p className="font-semibold text-mcm-text">{lightbox.titulo}</p>
              <div className="flex items-center gap-3">
                <a href={lightbox.url} target="_blank" rel="noreferrer"
                  className="text-xs text-[#a93526] hover:underline flex items-center gap-1">
                  <ExternalLink size={12} /> Abrir en nueva pestaña
                </a>
                <button onClick={() => setLightbox(null)} className="text-mcm-muted hover:text-mcm-text">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="bg-slate-100 rounded-b-2xl overflow-hidden flex items-center justify-center min-h-64 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.url}
                alt={lightbox.titulo}
                className="max-w-full max-h-[70vh] object-contain"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = "none";
                  const fallback = img.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
              <div style={{ display: "none" }}
                className="flex-col items-center gap-3 p-10 text-center">
                <p className="text-mcm-text font-medium text-sm">No se pudo cargar la imagen</p>
                <p className="text-mcm-muted text-xs break-all max-w-sm">{lightbox.url}</p>
                <a href={lightbox.url} target="_blank" rel="noreferrer"
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  <ExternalLink size={13} /> Intentar abrir directamente
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal rechazo con observaciones por campo */}
      {modalObs && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
            <h3 className="font-bold text-mcm-text text-lg mb-1">Rechazar solicitud</h3>
            <p className="text-mcm-muted text-sm mb-5">
              Indica qué documentos tienen problemas. Se enviará un correo automático a{" "}
              <strong>{modalObs.nombres} {modalObs.apellidos}</strong> con las instrucciones para corregirlos.
            </p>

            <div className="space-y-4">
              {([
                { key: "voucher",     label: "Voucher de pago" },
                { key: "dni_anverso", label: "DNI — Anverso" },
                { key: "dni_reverso", label: "DNI — Reverso" },
              ] as const).map(({ key, label }) => (
                <div key={key}>
                  <label className="flex items-center gap-2 mb-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!obsFields[key]}
                      onChange={(e) => setObsFields((p) => ({
                        ...p,
                        [key]: e.target.checked ? "Documento no válido o ilegible" : "",
                      }))}
                      className="w-4 h-4 accent-[#a93526]"
                    />
                    <span className="text-sm font-medium text-mcm-text">{label}</span>
                  </label>
                  {obsFields[key] !== "" && (
                    <input
                      type="text"
                      value={obsFields[key]}
                      onChange={(e) => setObsFields((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder="Describe el problema específico..."
                      className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526] ml-6"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalObs(null)} className="btn-secondary flex-1 text-sm">
                Cancelar
              </button>
              <button
                onClick={handleRechazar}
                disabled={!Object.values(obsFields).some(Boolean) || saving === modalObs.id}
                className="flex-1 text-sm text-white font-semibold px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving === modalObs.id && <Loader2 size={14} className="animate-spin" />}
                Confirmar Rechazo y Enviar Correo
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal confirmación limpieza */}
      {showLimpiar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-mcm-text text-lg mb-2">⚠️ Limpiar solicitudes</h3>
            <p className="text-mcm-muted text-sm mb-5">
              Esto borrará <strong>todas</strong> las solicitudes de la base de datos. Úsalo solo para eliminar datos de prueba. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLimpiar(false)} className="btn-secondary flex-1 text-sm">
                Cancelar
              </button>
              <button
                onClick={handleLimpiar}
                disabled={limpiando}
                className="flex-1 text-sm text-white font-semibold px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {limpiando && <Loader2 size={14} className="animate-spin" />}
                {limpiando ? "Borrando..." : "Sí, borrar todo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
