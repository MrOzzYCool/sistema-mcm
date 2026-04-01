"use client";

import { useState, useEffect, useCallback } from "react";
import { getSolicitudes, actualizarEstado } from "@/lib/solicitudes-service";
import { SolicitudDB } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import RouteGuard from "@/components/RouteGuard";
import { ACTUALIZACIONES_CATALOGO } from "@/lib/mock-data";
import {
  CheckCircle, XCircle, AlertTriangle, Eye, X,
  ExternalLink, RefreshCw, Loader2, BarChart2,
} from "lucide-react";
import clsx from "clsx";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Estado = SolicitudDB["estado"];
type Vista  = "solicitudes" | "reportes";

const ESTADO_BADGE: Record<NonNullable<Estado>, string> = {
  pendiente: "badge-yellow", aprobado: "badge-green",
  observado: "badge-blue",  rechazado: "badge-red",
};
const ESTADO_LABEL: Record<NonNullable<Estado>, string> = {
  pendiente: "Pendiente", aprobado: "Aprobado",
  observado: "Observado", rechazado: "Rechazado",
};

// ─── Contenido principal ──────────────────────────────────────────────────────

function ActualizacionContent() {
  const [todas, setTodas]           = useState<SolicitudDB[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [vista, setVista]           = useState<Vista>("solicitudes");
  // Pestaña activa: id de ACTUALIZACIONES_CATALOGO
  const [tabActiva, setTabActiva] = useState<string>(ACTUALIZACIONES_CATALOGO[0].id);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getSolicitudes("actualizacion");
      setTodas(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar, refreshKey]);
  useEffect(() => {
    function onFocus() { cargar(); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [cargar]);

  return (
    <div className="p-6 w-full space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Actualización</h1>
          <p className="text-mcm-muted text-sm mt-0.5">Gestión de solicitudes de actualización</p>
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

      {/* Selector de vista: Solicitudes / Reportes */}
      <div className="flex gap-2 border-b border-mcm-border pb-0">
        {(["solicitudes", "reportes"] as Vista[]).map((v) => (
          <button key={v} onClick={() => setVista(v)}
            className={clsx(
              "px-4 py-2 text-sm font-semibold border-b-2 transition-colors capitalize",
              vista === v
                ? "border-[#a93526] text-[#a93526]"
                : "border-transparent text-mcm-muted hover:text-mcm-text"
            )}>
            {v === "solicitudes" ? "📋 Solicitudes" : "📊 Reportes"}
          </button>
        ))}
      </div>

      {vista === "solicitudes" ? (
        <SolicitudesView
          todas={todas} loading={loading}
          tabActiva={tabActiva} setTabActiva={setTabActiva}
          setTodas={setTodas} setError={setError}
        />
      ) : (
        <ReportesView todas={todas} loading={loading} />
      )}
    </div>
  );
}

// ─── Vista Solicitudes ────────────────────────────────────────────────────────

function SolicitudesView({ todas, loading, tabActiva, setTabActiva, setTodas, setError }: {
  todas: SolicitudDB[];
  loading: boolean;
  tabActiva: string;
  setTabActiva: (id: string) => void;
  setTodas: React.Dispatch<React.SetStateAction<SolicitudDB[]>>;
  setError: (e: string) => void;
}) {
  const [filtro, setFiltro]     = useState<Estado | "todos">("todos");
  const [lightbox, setLightbox] = useState<{ url: string; titulo: string } | null>(null);
  const [modalObs, setModalObs] = useState<SolicitudDB | null>(null);
  const [obsFields, setObsFields] = useState({ voucher: "", dni_anverso: "", dni_reverso: "" });
  const [saving, setSaving]     = useState<string | null>(null);

  // Filtrar por pestaña activa
  const actCat    = ACTUALIZACIONES_CATALOGO.find((a) => a.id === tabActiva);
  const porTab    = todas.filter((s) => s.tipo_tramite === actCat?.label);
  const lista     = filtro === "todos" ? porTab : porTab.filter((s) => s.estado === filtro);

  const kpis = {
    todos:     porTab.length,
    pendiente: porTab.filter((s) => s.estado === "pendiente").length,
    aprobado:  porTab.filter((s) => s.estado === "aprobado").length,
    observado: porTab.filter((s) => s.estado === "observado").length,
  };

  async function handleAprobar(id: string) {
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
      setTodas((prev) =>
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
      setTodas((prev) =>
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

  async function handleObservar(id: string) {
    setSaving(id);
    try {
      await actualizarEstado(id, "observado");
      setTodas((prev) => prev.map((s) => s.id === id ? { ...s, estado: "observado" } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Pestañas por actualización */}
      <div className="flex flex-wrap gap-2">
        {ACTUALIZACIONES_CATALOGO.map((a) => {
          const count = todas.filter((s) => s.tipo_tramite === a.label).length;
          return (
            <button key={a.id} onClick={() => { setTabActiva(a.id); setFiltro("todos"); }}
              className={clsx(
                "px-4 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all",
                tabActiva === a.id
                  ? "border-[#a93526] bg-[#a93526] text-white shadow-sm"
                  : "border-mcm-border text-mcm-muted hover:border-[#a93526] hover:text-[#a93526]"
              )}>
              {a.label}
              <span className={clsx("ml-2 px-1.5 py-0.5 rounded-full text-xs",
                tabActiva === a.id ? "bg-white/30" : "bg-slate-100")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* KPIs / filtros de estado */}
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
                  {["Solicitante", "DNI", "Comprobante", "Monto", "Fecha", "Docs", "Estado", "Acciones"].map((h) => (
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
                      <p className="text-xs text-mcm-muted">{s.celular}</p>
                    </td>
                    <td className="py-4 px-4 font-mono text-sm text-mcm-text whitespace-nowrap">{s.dni}</td>
                    <td className="py-4 px-4 text-xs text-mcm-muted capitalize">{s.tipo_comprobante ?? "—"}</td>
                    <td className="py-4 px-4 font-semibold text-mcm-text whitespace-nowrap">
                      {Number(s.monto_pagado) > 0 ? `S/ ${Number(s.monto_pagado).toLocaleString()}` : "—"}
                    </td>
                    <td className="py-4 px-4 text-mcm-muted text-xs whitespace-nowrap">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1.5">
                        {s.voucher_url && (
                          <button onClick={() => setLightbox({ url: s.voucher_url, titulo: "Voucher" })}
                            className="flex items-center gap-1 text-xs text-[#a93526] hover:underline font-medium">
                            <Eye size={12} /> Voucher
                          </button>
                        )}
                        {s.dni_anverso_url && (
                          <button onClick={() => setLightbox({ url: s.dni_anverso_url, titulo: "DNI ▲" })}
                            className="flex items-center gap-1 text-xs text-mcm-muted hover:text-mcm-text font-medium">
                            <Eye size={12} /> DNI ▲
                          </button>
                        )}
                        {s.dni_reverso_url && (
                          <button onClick={() => setLightbox({ url: s.dni_reverso_url, titulo: "DNI ▼" })}
                            className="flex items-center gap-1 text-xs text-mcm-muted hover:text-mcm-text font-medium">
                            <Eye size={12} /> DNI ▼
                          </button>
                        )}
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
                            <button onClick={() => handleObservar(s.id!)}
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
                      No hay solicitudes para esta actualización.
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
              Indica los documentos con problemas para <strong>{modalObs.nombres} {modalObs.apellidos}</strong>.
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

// ─── Vista Reportes ───────────────────────────────────────────────────────────

function ReportesView({ todas, loading }: { todas: SolicitudDB[]; loading: boolean }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart2 size={18} className="text-mcm-muted" />
        <h2 className="font-semibold text-mcm-text">Reportes por actualización</h2>
        <span className="text-xs text-mcm-muted ml-1">— datos en tiempo real</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Cargando reportes...</span>
        </div>
      ) : (
        // Un reporte por cada actualización del catálogo — escala automáticamente
        <div className="space-y-6">
          {ACTUALIZACIONES_CATALOGO.map((a) => {
            const grupo     = todas.filter((s) => s.tipo_tramite === a.label);
            const aprobados = grupo.filter((s) => s.estado === "aprobado");
            const ingresos  = aprobados.reduce((acc, s) => acc + Number(s.monto_pagado), 0);

            return (
              <div key={a.id} className="card space-y-4">
                <h3 className="font-bold text-mcm-text text-sm border-b border-mcm-border pb-3">
                  {a.label}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <ReporteKpi label="Total inscritos"  value={grupo.length}                                    color="bg-slate-50 text-slate-600" />
                  <ReporteKpi label="Pendientes"       value={grupo.filter((s) => s.estado === "pendiente").length} color="bg-yellow-50 text-yellow-700" />
                  <ReporteKpi label="Aprobados"        value={aprobados.length}                                color="bg-green-50 text-green-700"  />
                  <ReporteKpi label="Rechazados"       value={grupo.filter((s) => s.estado === "rechazado").length} color="bg-red-50 text-red-700"      />
                  <ReporteKpi label="Observados"       value={grupo.filter((s) => s.estado === "observado").length} color="bg-blue-50 text-blue-700"    />
                  <ReporteKpi
                    label="Total ingresos"
                    value={`S/ ${ingresos.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`}
                    color="bg-emerald-50 text-emerald-700"
                    large
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReporteKpi({ label, value, color, large }: {
  label: string; value: string | number; color: string; large?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 ${color}`}>
      <p className="text-xs font-medium opacity-80 mb-1">{label}</p>
      <p className={`font-bold ${large ? "text-base" : "text-2xl"}`}>{value}</p>
    </div>
  );
}

// ─── Page con RouteGuard ──────────────────────────────────────────────────────

export default function ActualizacionPage() {
  return (
    <RouteGuard allowedRoles={["super_admin", "actualizacion"]}>
      <ActualizacionContent />
    </RouteGuard>
  );
}
