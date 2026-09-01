"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import RouteGuard from "@/components/RouteGuard";
import {
  Loader2, Download, Eye, ExternalLink, TrendingUp,
  Receipt, FileText, RefreshCw, AlertTriangle, XCircle,
  Pencil, Check, X,
} from "lucide-react";
import clsx from "clsx";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Ingreso {
  id: string;
  tipo: "cuota_academica" | "actualizacion" | "tramite";
  nombre: string;
  concepto: string;
  monto: number;
  fecha: string;
  voucher_url: string | null;
  comprobante_url: string | null;
  comprobante_tipo: string;
  comprobante_serie: string | null;
  comprobante_numero: string | null;
  banco: string | null;
  operation_number: string | null;
  ocr_status: string | null;
}

interface Resumen {
  total: number;
  cuotas: number;
  actualizaciones: number;
  tramites: number;
  cantidad_boletas: number;
  cantidad_facturas: number;
  total_registros: number;
}

const TIPO_LABEL: Record<string, string> = {
  cuota_academica: "Cuota Académica",
  actualizacion: "Actualización",
  tramite: "Trámite",
};

const TIPO_COLOR: Record<string, string> = {
  cuota_academica: "bg-blue-100 text-blue-700",
  actualizacion: "bg-purple-100 text-purple-700",
  tramite: "bg-amber-100 text-amber-700",
};

const SUPPORTED_BANKS = [
  "BCP",
  "Agente BCP",
  "Yape",
  "Plin",
  "Scotiabank",
  "Interbank",
  "BBVA",
  "Banco de la Nación",
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
}

function formatMoney(n: number): string {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Componente principal ─────────────────────────────────────────────────────

function ContabilidadContent() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroBanco, setFiltroBanco] = useState<string>("todos");
  const [lightbox, setLightbox] = useState<{ urls: string[]; titulo: string } | null>(null);

  // Manual OCR inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBanco, setEditBanco] = useState("");
  const [editOpNumber, setEditOpNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch(`/api/admin/contabilidad?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? `Error ${res.status}`);
      }
      const json = await res.json();
      setIngresos(json.ingresos ?? []);
      setResumen(json.resumen ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { cargar(); }, [cargar]);

  const listaFiltrada = ingresos
    .filter((i) => filtroTipo === "todos" || i.tipo === filtroTipo)
    .filter((i) => filtroBanco === "todos" || i.banco === filtroBanco);

  // Exportar a CSV
  function exportarCSV() {
    const headers = ["Fecha", "Tipo", "Nombre", "Concepto", "Monto", "Banco", "N° Operación", "Comprobante", "Serie-Número"];
    const rows = listaFiltrada.map((i) => [
      i.fecha,
      TIPO_LABEL[i.tipo] ?? i.tipo,
      i.nombre,
      i.concepto,
      i.monto.toFixed(2),
      i.banco ?? "Pendiente",
      i.operation_number ?? "Pendiente",
      i.comprobante_tipo,
      i.comprobante_serie && i.comprobante_numero
        ? `${i.comprobante_serie}-${i.comprobante_numero}`
        : "—",
    ]);
    const csv = [headers, ...rows].map((r) => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contabilidad-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Manual OCR: start editing a row
  function startEditing(ingreso: Ingreso) {
    setEditingId(ingreso.id);
    setEditBanco(ingreso.banco ?? "");
    setEditOpNumber(ingreso.operation_number ?? "");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditBanco("");
    setEditOpNumber("");
  }

  async function saveManualOcr() {
    if (!editingId || !editBanco.trim() || !editOpNumber.trim()) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch("/api/admin/contabilidad/manual-ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          voucher_id: editingId,
          operation_number: editOpNumber.trim(),
          banco: editBanco.trim(),
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? `Error ${res.status}`);
      }
      // Update local state
      setIngresos((prev) =>
        prev.map((ing) =>
          ing.id === editingId
            ? { ...ing, banco: editBanco.trim(), operation_number: editOpNumber.trim(), ocr_status: "completed" }
            : ing
        )
      );
      cancelEditing();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 w-full space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Contabilidad</h1>
          <p className="text-mcm-muted text-sm mt-0.5">Registro de ingresos — {formatMonth(month)}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="border border-mcm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526]" />
          <button onClick={cargar} disabled={loading}
            className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
          <button onClick={exportarCSV} disabled={listaFiltrada.length === 0}
            className="btn-primary flex items-center gap-2 text-sm">
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      {/* KPIs */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Total Ingresos" value={formatMoney(resumen.total)} color="bg-emerald-50 text-emerald-700" icon={<TrendingUp size={16} />} />
          <KpiCard label="Cuotas Académicas" value={formatMoney(resumen.cuotas)} color="bg-blue-50 text-blue-700" />
          <KpiCard label="Actualizaciones" value={formatMoney(resumen.actualizaciones)} color="bg-purple-50 text-purple-700" />
          <KpiCard label="Trámites" value={formatMoney(resumen.tramites)} color="bg-amber-50 text-amber-700" />
          <KpiCard label="Boletas emitidas" value={String(resumen.cantidad_boletas)} color="bg-slate-50 text-slate-700" icon={<Receipt size={16} />} />
          <KpiCard label="Facturas emitidas" value={String(resumen.cantidad_facturas)} color="bg-slate-50 text-slate-700" icon={<FileText size={16} />} />
        </div>
      )}

      {/* Filtros por tipo */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "todos", label: "Todos", count: ingresos.length },
          { key: "cuota_academica", label: "Cuotas", count: ingresos.filter(i => i.tipo === "cuota_academica").length },
          { key: "actualizacion", label: "Actualizaciones", count: ingresos.filter(i => i.tipo === "actualizacion").length },
          { key: "tramite", label: "Trámites", count: ingresos.filter(i => i.tipo === "tramite").length },
        ].map((f) => (
          <button key={f.key} onClick={() => setFiltroTipo(f.key)}
            className={clsx(
              "px-4 py-2 rounded-xl text-xs font-semibold border-2 transition-all",
              filtroTipo === f.key
                ? "border-[#C62828] bg-[#C62828] text-white"
                : "border-mcm-border text-mcm-muted hover:border-[#C62828]"
            )}>
            {f.label} <span className="ml-1 opacity-70">({f.count})</span>
          </button>
        ))}

        {/* Filtro por banco */}
        <select
          value={filtroBanco}
          onChange={(e) => setFiltroBanco(e.target.value)}
          className="border border-mcm-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526] ml-auto"
        >
          <option value="todos">Todos los bancos</option>
          {SUPPORTED_BANKS.map((banco) => (
            <option key={banco} value={banco}>{banco}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Cargando registros...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Fecha", "Tipo", "Nombre", "Concepto", "Monto", "Banco", "N° Operación", "Voucher", "Comprobante"].map((h) => (
                    <th key={h} className="text-left py-3.5 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((i) => (
                  <tr key={i.id} className="border-t border-mcm-border hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 text-mcm-muted text-xs whitespace-nowrap">{i.fecha}</td>
                    <td className="py-3.5 px-4">
                      <span className={clsx("px-2 py-1 rounded-full text-xs font-medium", TIPO_COLOR[i.tipo])}>
                        {TIPO_LABEL[i.tipo]}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-mcm-text">{i.nombre}</td>
                    <td className="py-3.5 px-4 text-mcm-muted text-xs">{i.concepto}</td>
                    <td className="py-3.5 px-4 font-semibold text-mcm-text whitespace-nowrap">{formatMoney(i.monto)}</td>
                    {/* Banco cell */}
                    <td className="py-3.5 px-4">
                      {editingId === i.id ? (
                        <select
                          value={editBanco}
                          onChange={(e) => setEditBanco(e.target.value)}
                          className="border border-mcm-border rounded px-2 py-1 text-xs w-full min-w-[100px] focus:outline-none focus:ring-1 focus:ring-[#a93526]"
                        >
                          <option value="">Seleccionar...</option>
                          {SUPPORTED_BANKS.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      ) : i.ocr_status === "processing" ? (
                        <span className="flex items-center gap-1 text-xs text-blue-600">
                          <Loader2 size={12} className="animate-spin" /> Procesando
                        </span>
                      ) : i.ocr_status === "needs_review" || i.ocr_status === "failed" ? (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          {i.ocr_status === "failed" ? <XCircle size={12} className="text-red-500" /> : <AlertTriangle size={12} />}
                          {i.banco ?? "Pendiente"}
                          <button
                            onClick={() => startEditing(i)}
                            className="ml-1 text-[#C62828] hover:text-[#a93526] transition-colors"
                            title="Editar manualmente"
                          >
                            <Pencil size={12} />
                          </button>
                        </span>
                      ) : (
                        <span className="text-xs text-mcm-text">{i.banco ?? "—"}</span>
                      )}
                    </td>
                    {/* N° Operación cell */}
                    <td className="py-3.5 px-4">
                      {editingId === i.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editOpNumber}
                            onChange={(e) => setEditOpNumber(e.target.value)}
                            placeholder="N° Operación"
                            className="border border-mcm-border rounded px-2 py-1 text-xs w-full min-w-[90px] focus:outline-none focus:ring-1 focus:ring-[#a93526]"
                          />
                          <button
                            onClick={saveManualOcr}
                            disabled={saving || !editBanco.trim() || !editOpNumber.trim()}
                            className="text-emerald-600 hover:text-emerald-700 disabled:opacity-40 transition-colors"
                            title="Guardar"
                          >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          </button>
                          <button
                            onClick={cancelEditing}
                            disabled={saving}
                            className="text-mcm-muted hover:text-red-500 disabled:opacity-40 transition-colors"
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : i.ocr_status === "processing" ? (
                        <span className="flex items-center gap-1 text-xs text-blue-600">
                          <Loader2 size={12} className="animate-spin" /> Procesando
                        </span>
                      ) : i.ocr_status === "needs_review" || i.ocr_status === "failed" ? (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          {i.ocr_status === "failed" ? <XCircle size={12} className="text-red-500" /> : <AlertTriangle size={12} />}
                          {i.operation_number ?? "Pendiente"}
                        </span>
                      ) : (
                        <span className="text-xs text-mcm-text">{i.operation_number ?? "—"}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {i.voucher_url ? (
                        <button onClick={() => setLightbox({ urls: i.voucher_url!.split(",").map((u) => u.trim()).filter(Boolean), titulo: "Voucher de pago" })}
                          className="flex items-center gap-1 text-xs text-[#C62828] hover:underline font-medium">
                          <Eye size={12} /> Ver
                        </button>
                      ) : (
                        <span className="text-xs text-mcm-muted">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {i.comprobante_url ? (
                        <a href={i.comprobante_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-[#C62828] hover:underline font-medium">
                          <ExternalLink size={11} />
                          {i.comprobante_serie && i.comprobante_numero
                            ? `${i.comprobante_serie}-${i.comprobante_numero}`
                            : i.comprobante_tipo === "factura" ? "Factura" : "Boleta"}
                        </a>
                      ) : (
                        <span className="text-xs text-mcm-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {listaFiltrada.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-mcm-muted text-sm">
                      No hay registros para este mes.
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
              <p className="font-semibold text-mcm-text">
                {lightbox.titulo}
                {lightbox.urls.length > 1 && (
                  <span className="ml-2 text-xs text-mcm-muted font-normal">({lightbox.urls.length} archivos)</span>
                )}
              </p>
              <button onClick={() => setLightbox(null)} className="text-mcm-muted hover:text-mcm-text text-xl">✕</button>
            </div>
            <div className="bg-slate-100 rounded-b-2xl overflow-y-auto max-h-[75vh] p-3 space-y-3">
              {lightbox.urls.map((url, idx) => {
                const isPdf = url.split("?")[0].toLowerCase().endsWith(".pdf");
                return (
                  <div key={idx} className="bg-white rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                      <span className="text-xs text-mcm-muted">
                        {lightbox.urls.length > 1 ? `Comprobante ${idx + 1}` : "Comprobante"}
                      </span>
                      <a href={url} target="_blank" rel="noreferrer"
                        className="text-xs text-[#C62828] hover:underline flex items-center gap-1">
                        <ExternalLink size={12} /> Abrir
                      </a>
                    </div>
                    {isPdf ? (
                      <div className="flex flex-col items-center gap-2 p-3">
                        <embed src={url} type="application/pdf" className="w-full h-[60vh] rounded-lg" />
                        <a href={url} target="_blank" rel="noreferrer"
                          className="text-xs text-[#C62828] hover:underline flex items-center gap-1">
                          <ExternalLink size={12} /> Abrir PDF
                        </a>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={`${lightbox.titulo} ${idx + 1}`} className="w-full max-h-[70vh] object-contain" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, icon }: {
  label: string; value: string; color: string; icon?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl p-3.5 ${color}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-xs font-medium opacity-80">{label}</p>
      </div>
      <p className="font-bold text-lg">{value}</p>
    </div>
  );
}

// ─── Page con RouteGuard ──────────────────────────────────────────────────────

export default function ContabilidadPage() {
  return (
    <RouteGuard allowedRoles={["super_admin", "contabilidad"]}>
      <ContabilidadContent />
    </RouteGuard>
  );
}
