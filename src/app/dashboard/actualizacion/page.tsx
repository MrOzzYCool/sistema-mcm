"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSolicitudes, actualizarEstado } from "@/lib/solicitudes-service";
import { SolicitudDB } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import RouteGuard from "@/components/RouteGuard";
import { ACTUALIZACIONES_CATALOGO } from "@/lib/mock-data";
import {
  CheckCircle, XCircle, AlertTriangle, Eye, X,
  ExternalLink, RefreshCw, Loader2, BarChart2, Plus, Upload, Pencil,
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
  const { user } = useAuth();
  const [todas, setTodas]           = useState<SolicitudDB[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [vista, setVista]           = useState<Vista>("solicitudes");
  // Pestaña activa: id de ACTUALIZACIONES_CATALOGO
  const [tabActiva, setTabActiva] = useState<string>(ACTUALIZACIONES_CATALOGO[0].id);
  const [showRegistroManual, setShowRegistroManual] = useState(false);

  const esSuperAdmin = user?.role === "super_admin";

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
          {esSuperAdmin && (
            <button onClick={() => setShowRegistroManual(true)}
              className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Registrar inscripción
            </button>
          )}
          <button onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}
            className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
          <a href="/actualizaciones" target="_blank" className="btn-secondary flex items-center gap-2 text-sm">
            <ExternalLink size={14} /> Formulario público
          </a>
          <a href="/certificados-actualizacion" target="_blank" className="btn-secondary flex items-center gap-2 text-sm">
            <ExternalLink size={14} /> Formulario certificados
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
                ? "border-[#C62828] text-[#C62828]"
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
          esSuperAdmin={esSuperAdmin}
        />
      ) : (
        <ReportesView todas={todas} loading={loading} />
      )}

      {/* Modal Registro Manual */}
      {showRegistroManual && (
        <RegistroManualModal
          onClose={() => setShowRegistroManual(false)}
          onSuccess={() => { setShowRegistroManual(false); setRefreshKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}

// ─── Vista Solicitudes ────────────────────────────────────────────────────────

function SolicitudesView({ todas, loading, tabActiva, setTabActiva, setTodas, setError, esSuperAdmin }: {
  todas: SolicitudDB[];
  loading: boolean;
  tabActiva: string;
  setTabActiva: (id: string) => void;
  setTodas: React.Dispatch<React.SetStateAction<SolicitudDB[]>>;
  setError: (e: string) => void;
  esSuperAdmin: boolean;
}) {
  const [filtro, setFiltro]     = useState<Estado | "todos">("todos");
  const [lightbox, setLightbox] = useState<{ url: string; titulo: string } | null>(null);
  const [modalObs, setModalObs] = useState<SolicitudDB | null>(null);
  const [obsFields, setObsFields] = useState({ voucher: "", dni_anverso: "", dni_reverso: "" });
  const [saving, setSaving]     = useState<string | null>(null);
  const [editDocsSol, setEditDocsSol] = useState<SolicitudDB | null>(null);
  const [editMontoSol, setEditMontoSol] = useState<SolicitudDB | null>(null);

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
                  ? "border-[#C62828] bg-[#C62828] text-white shadow-sm"
                  : "border-mcm-border text-mcm-muted hover:border-[#C62828] hover:text-[#C62828]"
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
            className={clsx("card text-left transition-all", filtro === e ? "ring-2 ring-[#C62828]" : "hover:shadow-md")}>
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
                        {s.voucher_url && s.voucher_url !== "registro-manual" && (
                          <button onClick={() => setLightbox({ url: s.voucher_url, titulo: "Voucher" })}
                            className="flex items-center gap-1 text-xs text-[#C62828] hover:underline font-medium">
                            <Eye size={12} /> Voucher
                          </button>
                        )}
                        {s.dni_anverso_url && s.dni_anverso_url !== "registro-manual" && (
                          <button onClick={() => setLightbox({ url: s.dni_anverso_url, titulo: "DNI ▲" })}
                            className="flex items-center gap-1 text-xs text-mcm-muted hover:text-mcm-text font-medium">
                            <Eye size={12} /> DNI ▲
                          </button>
                        )}
                        {s.dni_reverso_url && s.dni_reverso_url !== "registro-manual" && (
                          <button onClick={() => setLightbox({ url: s.dni_reverso_url, titulo: "DNI ▼" })}
                            className="flex items-center gap-1 text-xs text-mcm-muted hover:text-mcm-text font-medium">
                            <Eye size={12} /> DNI ▼
                          </button>
                        )}
                        {(!s.voucher_url || s.voucher_url === "registro-manual") && (
                          <span className="text-xs text-mcm-muted italic">Sin docs</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={ESTADO_BADGE[s.estado ?? "pendiente"]}>{ESTADO_LABEL[s.estado ?? "pendiente"]}</span>
                      {s.estado === "aprobado" && s.pdf_boleta_url && (
                        <a href={s.pdf_boleta_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-[#C62828] hover:underline font-medium mt-1">
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
                          {s.estado !== "aprobado" && s.estado !== "observado" && (
                            <button onClick={() => handleObservar(s.id!)}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
                              <AlertTriangle size={12} /> Observar
                            </button>
                          )}
                          {s.estado !== "aprobado" && s.estado !== "rechazado" && (
                            <button onClick={() => { setModalObs(s); setObsFields({ voucher: "", dni_anverso: "", dni_reverso: "" }); }}
                              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap">
                              <XCircle size={12} /> Rechazar
                            </button>
                          )}
                          {esSuperAdmin && (
                            <button onClick={() => setEditDocsSol(s)}
                              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium whitespace-nowrap">
                              <Pencil size={12} /> Editar docs
                            </button>
                          )}
                          {esSuperAdmin && (
                            <button onClick={() => setEditMontoSol(s)}
                              className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium whitespace-nowrap">
                              <Pencil size={12} /> Editar monto
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
                  className="text-xs text-[#C62828] hover:underline flex items-center gap-1">
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
                      className="w-4 h-4 accent-[#C62828]" />
                    <span className="text-sm font-medium text-mcm-text">{label}</span>
                  </label>
                  {obsFields[key] !== "" && (
                    <input type="text" value={obsFields[key]}
                      onChange={(e) => setObsFields((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder="Describe el problema..."
                      className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C62828] ml-6" />
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

      {/* Modal editar docs */}
      {editDocsSol && (
        <EditDocsModal
          solicitud={editDocsSol}
          onClose={() => setEditDocsSol(null)}
          onSuccess={(updated) => {
            setTodas((prev) => prev.map((s) => s.id === updated.id ? { ...s, ...updated } : s));
            setEditDocsSol(null);
          }}
        />
      )}

      {/* Modal editar monto */}
      {editMontoSol && (
        <EditMontoModal
          solicitud={editMontoSol}
          onClose={() => setEditMontoSol(null)}
          onSuccess={(id, nuevoMonto) => {
            setTodas((prev) => prev.map((s) => s.id === id ? { ...s, monto_pagado: nuevoMonto } : s));
            setEditMontoSol(null);
          }}
        />
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

// ─── Modal Registro Manual ────────────────────────────────────────────────────

type RegistroForm = {
  nombres: string; apellidos: string; dni: string;
  email: string; celular: string;
  actualizacionId: string;
  tipoComprobante: "boleta" | "factura" | "";
  ruc: string; razonSocial: string; direccionFiscal: string;
};

const REGISTRO_INIT: RegistroForm = {
  nombres: "", apellidos: "", dni: "", email: "", celular: "",
  actualizacionId: "", tipoComprobante: "",
  ruc: "", razonSocial: "", direccionFiscal: "",
};

function RegistroManualModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<RegistroForm>(REGISTRO_INIT);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [dniAnversoFile, setDniAnversoFile] = useState<File | null>(null);
  const [dniReversoFile, setDniReversoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const voucherInputRef = useRef<HTMLInputElement>(null);
  const dniAnversoInputRef = useRef<HTMLInputElement>(null);
  const dniReversoInputRef = useRef<HTMLInputElement>(null);

  const actualizacion = ACTUALIZACIONES_CATALOGO.find((a) => a.id === form.actualizacionId);

  const puedeGuardar =
    !!form.nombres.trim() && !!form.apellidos.trim() &&
    form.dni.length === 8 && !!actualizacion && !!form.tipoComprobante &&
    (form.tipoComprobante === "boleta" || form.ruc.length === 11);

  function set(k: keyof RegistroForm, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeGuardar || !actualizacion) return;
    setSaving(true);
    setError("");

    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      // Subir PDF si se adjuntó
      let pdfUrl: string | null = null;
      if (pdfFile) {
        const ts = Math.floor(Date.now() / 1000);
        const ext = pdfFile.name.split(".").pop()?.toLowerCase() || "pdf";
        const path = `${form.dni.trim()}/comprobante-manual-${ts}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("tramites-mcm")
          .upload(path, pdfFile, { upsert: true, contentType: pdfFile.type });
        if (upErr) throw new Error(`Error subiendo PDF: ${upErr.message}`);
        const { data: urlData } = supabase.storage.from("tramites-mcm").getPublicUrl(path);
        pdfUrl = urlData.publicUrl;
      }

      // Subir voucher si se adjuntó
      let voucherUrl: string | null = null;
      if (voucherFile) {
        const ts = Math.floor(Date.now() / 1000);
        const ext = voucherFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${form.dni.trim()}/voucher-manual-${ts}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("tramites-mcm")
          .upload(path, voucherFile, { upsert: true, contentType: voucherFile.type });
        if (upErr) throw new Error(`Error subiendo voucher: ${upErr.message}`);
        const { data: urlData } = supabase.storage.from("tramites-mcm").getPublicUrl(path);
        voucherUrl = urlData.publicUrl;
      }

      // Subir DNI anverso si se adjuntó
      let dniAnversoUrl: string | null = null;
      if (dniAnversoFile) {
        const ts = Math.floor(Date.now() / 1000);
        const ext = dniAnversoFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${form.dni.trim()}/dni-anverso-manual-${ts}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("tramites-mcm")
          .upload(path, dniAnversoFile, { upsert: true, contentType: dniAnversoFile.type });
        if (upErr) throw new Error(`Error subiendo DNI anverso: ${upErr.message}`);
        const { data: urlData } = supabase.storage.from("tramites-mcm").getPublicUrl(path);
        dniAnversoUrl = urlData.publicUrl;
      }

      // Subir DNI reverso si se adjuntó
      let dniReversoUrl: string | null = null;
      if (dniReversoFile) {
        const ts = Math.floor(Date.now() / 1000);
        const ext = dniReversoFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${form.dni.trim()}/dni-reverso-manual-${ts}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("tramites-mcm")
          .upload(path, dniReversoFile, { upsert: true, contentType: dniReversoFile.type });
        if (upErr) throw new Error(`Error subiendo DNI reverso: ${upErr.message}`);
        const { data: urlData } = supabase.storage.from("tramites-mcm").getPublicUrl(path);
        dniReversoUrl = urlData.publicUrl;
      }

      const res = await fetch("/api/admin/solicitudes-ops/registro-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombres:          form.nombres.trim(),
          apellidos:        form.apellidos.trim(),
          dni:              form.dni.trim(),
          email:            form.email.trim().toLowerCase(),
          celular:          form.celular.trim(),
          tipo_tramite:     actualizacion.label,
          monto_pagado:     actualizacion.costo,
          tipo_comprobante: form.tipoComprobante,
          pdf_boleta_url:   pdfUrl,
          voucher_url:      voucherUrl,
          dni_anverso_url:  dniAnversoUrl,
          dni_reverso_url:  dniReversoUrl,
          ...(form.tipoComprobante === "factura" && {
            ruc:              form.ruc,
            razon_social:     form.razonSocial.trim(),
            direccion_fiscal: form.direccionFiscal.trim(),
          }),
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Error al registrar");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg my-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-mcm-text text-lg">Registrar inscripción existente</h3>
            <p className="text-mcm-muted text-xs mt-0.5">
              Para alumnas ya inscritas fuera del sistema — NO genera comprobante nuevo en Nubefact.
            </p>
          </div>
          <button onClick={onClose} className="text-mcm-muted hover:text-mcm-text">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Datos personales */}
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Nombres" value={form.nombres}
              onChange={(v) => set("nombres", v.toUpperCase())} placeholder="MARÍA ELENA" required />
            <InputField label="Apellidos" value={form.apellidos}
              onChange={(v) => set("apellidos", v.toUpperCase())} placeholder="GARCÍA LÓPEZ" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-mcm-text mb-1">DNI *</label>
              <input type="text" value={form.dni}
                onChange={(e) => set("dni", e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="12345678" maxLength={8} required
                className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526]" />
            </div>
            <InputField label="Celular" value={form.celular} onChange={(v) => set("celular", v)} placeholder="987654321" />
          </div>
          <InputField label="Email" value={form.email} onChange={(v) => set("email", v)} placeholder="alumna@ejemplo.com" />

          {/* Actualización */}
          <div>
            <label className="block text-xs font-medium text-mcm-text mb-1">Actualización *</label>
            <select value={form.actualizacionId} onChange={(e) => set("actualizacionId", e.target.value)} required
              className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526]">
              <option value="">Selecciona...</option>
              {ACTUALIZACIONES_CATALOGO.map((a) => (
                <option key={a.id} value={a.id}>{a.label} — S/ {a.costo}</option>
              ))}
            </select>
          </div>

          {/* Tipo comprobante */}
          <div>
            <label className="block text-xs font-medium text-mcm-text mb-1">Tipo de comprobante *</label>
            <div className="grid grid-cols-2 gap-2">
              {(["boleta", "factura"] as const).map((tipo) => (
                <button key={tipo} type="button" onClick={() => set("tipoComprobante", tipo)}
                  className={clsx(
                    "py-2.5 rounded-xl border-2 text-sm font-semibold transition-all",
                    form.tipoComprobante === tipo
                      ? "border-[#a93526] bg-red-50 text-[#a93526]"
                      : "border-mcm-border text-mcm-muted hover:border-[#a93526]"
                  )}>
                  {tipo === "boleta" ? "🧾 Boleta" : "📄 Factura"}
                </button>
              ))}
            </div>
          </div>

          {form.tipoComprobante === "factura" && (
            <div className="space-y-3 border-l-4 border-[#a93526]/20 pl-4">
              <div>
                <label className="block text-xs font-medium text-mcm-text mb-1">RUC *</label>
                <input type="text" value={form.ruc}
                  onChange={(e) => set("ruc", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="20123456789" maxLength={11} required
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526]" />
              </div>
              <InputField label="Razón Social *" value={form.razonSocial}
                onChange={(v) => set("razonSocial", v.toUpperCase())} placeholder="EMPRESA S.A.C." required />
              <InputField label="Dirección Fiscal *" value={form.direccionFiscal}
                onChange={(v) => set("direccionFiscal", v)} placeholder="Av. Principal 123, Lima" required />
            </div>
          )}

          {/* Voucher de pago */}
          <div>
            <label className="block text-xs font-medium text-mcm-text mb-1">
              Voucher de pago *
            </label>
            {voucherFile ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-300 rounded-xl px-4 py-3">
                <CheckCircle size={16} className="text-green-600 shrink-0" />
                <p className="text-xs text-green-700 font-medium truncate flex-1">{voucherFile.name}</p>
                <button type="button" onClick={() => { setVoucherFile(null); if (voucherInputRef.current) voucherInputRef.current.value = ""; }}
                  className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center shrink-0">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div onClick={() => voucherInputRef.current?.click()}
                className="border-2 border-dashed border-mcm-border hover:border-[#a93526] hover:bg-red-50 rounded-xl p-4 text-center cursor-pointer transition-colors">
                <Upload size={20} className="text-mcm-muted mx-auto mb-1" />
                <p className="text-xs text-mcm-muted font-medium">Subir voucher de pago</p>
                <p className="text-xs text-mcm-muted">JPG, PNG o PDF</p>
              </div>
            )}
            <input ref={voucherInputRef} type="file" accept="image/*,.pdf" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) setVoucherFile(e.target.files[0]); }} />
          </div>

          {/* DNI Anverso */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-mcm-text mb-1">DNI — Anverso</label>
              {dniAnversoFile ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-300 rounded-xl px-3 py-2.5">
                  <CheckCircle size={14} className="text-green-600 shrink-0" />
                  <p className="text-xs text-green-700 font-medium truncate flex-1">{dniAnversoFile.name}</p>
                  <button type="button" onClick={() => { setDniAnversoFile(null); if (dniAnversoInputRef.current) dniAnversoInputRef.current.value = ""; }}
                    className="w-5 h-5 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center shrink-0">
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <div onClick={() => dniAnversoInputRef.current?.click()}
                  className="border-2 border-dashed border-mcm-border hover:border-[#a93526] hover:bg-red-50 rounded-xl p-3 text-center cursor-pointer transition-colors">
                  <Upload size={16} className="text-mcm-muted mx-auto mb-0.5" />
                  <p className="text-xs text-mcm-muted">Subir</p>
                </div>
              )}
              <input ref={dniAnversoInputRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) setDniAnversoFile(e.target.files[0]); }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-mcm-text mb-1">DNI — Reverso</label>
              {dniReversoFile ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-300 rounded-xl px-3 py-2.5">
                  <CheckCircle size={14} className="text-green-600 shrink-0" />
                  <p className="text-xs text-green-700 font-medium truncate flex-1">{dniReversoFile.name}</p>
                  <button type="button" onClick={() => { setDniReversoFile(null); if (dniReversoInputRef.current) dniReversoInputRef.current.value = ""; }}
                    className="w-5 h-5 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center shrink-0">
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <div onClick={() => dniReversoInputRef.current?.click()}
                  className="border-2 border-dashed border-mcm-border hover:border-[#a93526] hover:bg-red-50 rounded-xl p-3 text-center cursor-pointer transition-colors">
                  <Upload size={16} className="text-mcm-muted mx-auto mb-0.5" />
                  <p className="text-xs text-mcm-muted">Subir</p>
                </div>
              )}
              <input ref={dniReversoInputRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) setDniReversoFile(e.target.files[0]); }} />
            </div>
          </div>

          {/* PDF del comprobante existente */}
          <div>
            <label className="block text-xs font-medium text-mcm-text mb-1">
              Comprobante PDF (boleta/factura)
            </label>
            {pdfFile ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-300 rounded-xl px-4 py-3">
                <CheckCircle size={16} className="text-green-600 shrink-0" />
                <p className="text-xs text-green-700 font-medium truncate flex-1">{pdfFile.name}</p>
                <button type="button" onClick={() => { setPdfFile(null); if (pdfInputRef.current) pdfInputRef.current.value = ""; }}
                  className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center shrink-0">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div onClick={() => pdfInputRef.current?.click()}
                className="border-2 border-dashed border-mcm-border hover:border-[#a93526] hover:bg-red-50 rounded-xl p-4 text-center cursor-pointer transition-colors">
                <Upload size={20} className="text-mcm-muted mx-auto mb-1" />
                <p className="text-xs text-mcm-muted font-medium">Haz clic para subir el PDF</p>
                <p className="text-xs text-mcm-muted">PDF, JPG o PNG del comprobante</p>
              </div>
            )}
            <input ref={pdfInputRef} type="file" accept=".pdf,image/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) setPdfFile(e.target.files[0]); }} />
            <p className="text-xs text-mcm-muted mt-1">
              Opcional — adjunta el PDF de la boleta o factura ya generada.
            </p>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancelar</button>
            <button type="submit" disabled={!puedeGuardar || saving}
              className="flex-1 text-sm text-white font-semibold px-4 py-2.5 rounded-lg bg-[#C62828] hover:bg-[#B71C1C] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Guardando..." : "Registrar como aprobado"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-mcm-text mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526]" />
    </div>
  );
}

// ─── Modal Editar Monto ───────────────────────────────────────────────────────

function EditMontoModal({ solicitud, onClose, onSuccess }: {
  solicitud: SolicitudDB;
  onClose: () => void;
  onSuccess: (id: string, nuevoMonto: number) => void;
}) {
  const [monto, setMonto] = useState(String(Number(solicitud.monto_pagado ?? 0)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const nuevoMonto = parseFloat(monto);
    if (isNaN(nuevoMonto) || nuevoMonto < 0) {
      setError("Monto inválido");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const res = await fetch("/api/admin/solicitudes-ops", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: solicitud.id, monto_pagado: nuevoMonto }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Error actualizando");
      }
      onSuccess(solicitud.id!, nuevoMonto);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-mcm-text text-lg">Editar monto</h3>
          <button onClick={onClose} className="text-mcm-muted hover:text-mcm-text"><X size={20} /></button>
        </div>
        <p className="text-mcm-muted text-xs mb-4">{solicitud.nombres} {solicitud.apellidos}</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 mb-3 text-xs">{error}</div>
        )}

        <div>
          <label className="block text-xs font-medium text-mcm-text mb-1">Monto pagado (S/)</label>
          <input type="number" step="0.01" min="0" value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full border border-mcm-border rounded-lg px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#C62828]" />
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 text-sm text-white font-semibold px-4 py-2.5 rounded-lg bg-[#C62828] hover:bg-[#B71C1C] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Editar Documentos ──────────────────────────────────────────────────

function EditDocsModal({ solicitud, onClose, onSuccess }: {
  solicitud: SolicitudDB;
  onClose: () => void;
  onSuccess: (updated: Partial<SolicitudDB> & { id: string }) => void;
}) {
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [dniAnversoFile, setDniAnversoFile] = useState<File | null>(null);
  const [dniReversoFile, setDniReversoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const voucherRef = useRef<HTMLInputElement>(null);
  const dniAnversoRef = useRef<HTMLInputElement>(null);
  const dniReversoRef = useRef<HTMLInputElement>(null);

  const tieneVoucher = solicitud.voucher_url && solicitud.voucher_url !== "registro-manual";
  const tieneAnverso = solicitud.dni_anverso_url && solicitud.dni_anverso_url !== "registro-manual";
  const tieneReverso = solicitud.dni_reverso_url && solicitud.dni_reverso_url !== "registro-manual";

  async function handleSave() {
    if (!voucherFile && !dniAnversoFile && !dniReversoFile) {
      onClose();
      return;
    }
    setSaving(true);
    setError("");

    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const ts = Math.floor(Date.now() / 1000);
      const dni = solicitud.dni;

      const updates: Record<string, string> = {};

      if (voucherFile) {
        const ext = voucherFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${dni}/voucher-edit-${ts}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("tramites-mcm").upload(path, voucherFile, { upsert: true, contentType: voucherFile.type });
        if (upErr) throw new Error(`Error subiendo voucher: ${upErr.message}`);
        const { data } = supabase.storage.from("tramites-mcm").getPublicUrl(path);
        updates.voucher_url = data.publicUrl;
      }

      if (dniAnversoFile) {
        const ext = dniAnversoFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${dni}/dni-anverso-edit-${ts}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("tramites-mcm").upload(path, dniAnversoFile, { upsert: true, contentType: dniAnversoFile.type });
        if (upErr) throw new Error(`Error subiendo DNI anverso: ${upErr.message}`);
        const { data } = supabase.storage.from("tramites-mcm").getPublicUrl(path);
        updates.dni_anverso_url = data.publicUrl;
      }

      if (dniReversoFile) {
        const ext = dniReversoFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${dni}/dni-reverso-edit-${ts}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("tramites-mcm").upload(path, dniReversoFile, { upsert: true, contentType: dniReversoFile.type });
        if (upErr) throw new Error(`Error subiendo DNI reverso: ${upErr.message}`);
        const { data } = supabase.storage.from("tramites-mcm").getPublicUrl(path);
        updates.dni_reverso_url = data.publicUrl;
      }

      // Actualizar en BD
      const res = await fetch("/api/admin/solicitudes-ops", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: solicitud.id, ...updates }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Error actualizando");
      }

      onSuccess({ id: solicitud.id!, ...updates });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md my-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-mcm-text text-lg">Editar documentos</h3>
            <p className="text-mcm-muted text-xs mt-0.5">{solicitud.nombres} {solicitud.apellidos}</p>
          </div>
          <button onClick={onClose} className="text-mcm-muted hover:text-mcm-text"><X size={20} /></button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
        )}

        <div className="space-y-4">
          {/* Voucher */}
          <DocUploadField
            label="Voucher de pago"
            currentUrl={tieneVoucher ? solicitud.voucher_url : null}
            file={voucherFile}
            inputRef={voucherRef}
            onFileChange={setVoucherFile}
          />

          {/* DNI Anverso */}
          <DocUploadField
            label="DNI — Anverso"
            currentUrl={tieneAnverso ? solicitud.dni_anverso_url : null}
            file={dniAnversoFile}
            inputRef={dniAnversoRef}
            onFileChange={setDniAnversoFile}
          />

          {/* DNI Reverso */}
          <DocUploadField
            label="DNI — Reverso"
            currentUrl={tieneReverso ? solicitud.dni_reverso_url : null}
            file={dniReversoFile}
            inputRef={dniReversoRef}
            onFileChange={setDniReversoFile}
          />
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 text-sm text-white font-semibold px-4 py-2.5 rounded-lg bg-[#C62828] hover:bg-[#B71C1C] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocUploadField({ label, currentUrl, file, inputRef, onFileChange }: {
  label: string;
  currentUrl: string | null;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onFileChange: (f: File | null) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-mcm-text mb-1">{label}</label>
      {currentUrl && !file && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2">
          <CheckCircle size={14} className="text-green-600" />
          <a href={currentUrl} target="_blank" rel="noreferrer" className="text-xs text-green-700 hover:underline truncate flex-1">
            Archivo actual
          </a>
        </div>
      )}
      {file ? (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-300 rounded-xl px-4 py-3">
          <Upload size={14} className="text-blue-600 shrink-0" />
          <p className="text-xs text-blue-700 font-medium truncate flex-1">{file.name}</p>
          <button type="button" onClick={() => { onFileChange(null); if (inputRef.current) inputRef.current.value = ""; }}
            className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center shrink-0">
            <X size={12} />
          </button>
        </div>
      ) : (
        <div onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-mcm-border hover:border-[#a93526] hover:bg-red-50 rounded-xl p-3 text-center cursor-pointer transition-colors">
          <Upload size={16} className="text-mcm-muted mx-auto mb-0.5" />
          <p className="text-xs text-mcm-muted">{currentUrl ? "Reemplazar archivo" : "Subir archivo"}</p>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) onFileChange(e.target.files[0]); }} />
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
