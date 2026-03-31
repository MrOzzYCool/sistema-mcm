"use client";

import RouteGuard from "@/components/RouteGuard";
import { getSolicitudes } from "@/lib/solicitudes-service";
import { SolicitudDB } from "@/lib/supabase";
import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, Clock, CheckCircle, DollarSign, RefreshCw, Loader2 } from "lucide-react";

// ─── Helpers de agrupación ────────────────────────────────────────────────────

function agruparPorTipo(solicitudes: SolicitudDB[]) {
  const map: Record<string, number> = {};
  for (const s of solicitudes) {
    // Extraer nombre corto: quitar paréntesis y texto "INSTITUTO"
    const nombre = s.tipo_tramite
      .replace(/\s*\(.*?\)\s*/g, " ")
      .replace(/\bINSTITUTO\b/gi, "")
      .trim()
      .slice(0, 28);
    map[nombre] = (map[nombre] ?? 0) + 1;
  }
  return Object.entries(map)
    .map(([tipo, cantidad]) => ({ tipo, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 8);
}

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function agruparIngresosPorMes(solicitudes: SolicitudDB[]) {
  const map: Record<string, number> = {};
  for (const s of solicitudes) {
    if (s.estado !== "aprobado" || !s.created_at) continue;
    const d   = new Date(s.created_at);
    const key = `${MESES[d.getMonth()]} ${d.getFullYear()}`;
    map[key]  = (map[key] ?? 0) + Number(s.monto_pagado);
  }
  return Object.entries(map)
    .map(([mes, total]) => ({ mes, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => {
      const [mA, yA] = a.mes.split(" ");
      const [mB, yB] = b.mes.split(" ");
      return Number(yA) !== Number(yB)
        ? Number(yA) - Number(yB)
        : MESES.indexOf(mA) - MESES.indexOf(mB);
    });
}

// ─── Contenido ────────────────────────────────────────────────────────────────

function ReportesContent() {
  const [solicitudes, setSolicitudes] = useState<SolicitudDB[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [refreshKey, setRefreshKey]   = useState(0);
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getSolicitudes();
      setSolicitudes(data);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar al montar y al cambiar refreshKey
  useEffect(() => { cargar(); }, [cargar, refreshKey]);

  // Recargar al volver a la pestaña
  useEffect(() => {
    function onFocus() { cargar(); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [cargar]);

  // ── KPIs calculados desde Supabase ──────────────────────────────────────────
  const aprobadas   = solicitudes.filter((s) => s.estado === "aprobado");
  const pendientes  = solicitudes.filter((s) => s.estado === "pendiente");
  const procesadas  = solicitudes.filter((s) => s.estado === "aprobado" || s.estado === "rechazado");

  const totalIngresos    = aprobadas.reduce((acc, s) => acc + Number(s.monto_pagado), 0);
  const tramiteMasSolicitado = (() => {
    if (!solicitudes.length) return "—";
    const map: Record<string, number> = {};
    for (const s of solicitudes) map[s.tipo_tramite] = (map[s.tipo_tramite] ?? 0) + 1;
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0]
      .replace(/\s*\(.*?\)\s*/g, " ").replace(/\bINSTITUTO\b/gi, "").trim() ?? "—";
  })();

  // ── Datos para gráficos ─────────────────────────────────────────────────────
  const datosPorTipo  = agruparPorTipo(solicitudes);
  const datosIngresos = agruparIngresosPorMes(solicitudes);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Reportes y Estadísticas</h1>
          <p className="text-mcm-muted text-sm mt-0.5">
            Datos en tiempo real desde Supabase
            {lastUpdate && (
              <span className="ml-2 text-xs">
                · Actualizado: {lastUpdate.toLocaleTimeString("es-PE")}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refrescar Datos
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Ingresos"
          value={loading ? "…" : `S/ ${totalIngresos.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`}
          sub="Solo aprobados"
          icon={<DollarSign size={20} />}
          color="bg-green-50 text-green-600"
        />
        <KpiCard
          label="Pendientes"
          value={loading ? "…" : String(pendientes.length)}
          sub="En espera de revisión"
          icon={<Clock size={20} />}
          color="bg-yellow-50 text-yellow-600"
        />
        <KpiCard
          label="Procesados"
          value={loading ? "…" : String(procesadas.length)}
          sub="Aprobados + Rechazados"
          icon={<CheckCircle size={20} />}
          color="bg-blue-50 text-blue-600"
        />
        <KpiCard
          label="Más solicitado"
          value={loading ? "…" : tramiteMasSolicitado}
          sub={`${solicitudes.length} solicitudes totales`}
          icon={<TrendingUp size={20} />}
          color="bg-red-50 text-red-600"
          small
        />
      </div>

      {/* Gráficos */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-mcm-muted">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-sm">Cargando datos...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Barras: trámites por tipo — datos reales */}
          <div className="card">
            <h2 className="font-semibold text-mcm-text mb-1">Trámites más solicitados</h2>
            <p className="text-xs text-mcm-muted mb-4">Todas las solicitudes ({solicitudes.length} total)</p>
            {datosPorTipo.length === 0 ? (
              <p className="text-center text-mcm-muted text-sm py-10">Sin datos aún</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={datosPorTipo} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="tipo" tick={{ fontSize: 10, fill: "#64748b" }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(v) => [`${v} solicitudes`, "Cantidad"]}
                  />
                  <Bar dataKey="cantidad" fill="#a93526" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Línea: ingresos por mes — datos reales */}
          <div className="card">
            <h2 className="font-semibold text-mcm-text mb-1">Ingresos por mes (S/)</h2>
            <p className="text-xs text-mcm-muted mb-4">
              Solo solicitudes aprobadas · Total: S/ {totalIngresos.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
            </p>
            {datosIngresos.length === 0 ? (
              <p className="text-center text-mcm-muted text-sm py-10">Sin ingresos registrados aún</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={datosIngresos} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(v) => [`S/ ${Number(v).toLocaleString("es-PE")}`, "Ingresos"]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="total" name="Ingresos" stroke="#a93526"
                    strokeWidth={2.5} dot={{ fill: "#a93526", r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Tabla recientes */}
      {!loading && solicitudes.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-mcm-border flex items-center justify-between">
            <h2 className="font-semibold text-mcm-text">Solicitudes recientes</h2>
            <span className="text-xs text-mcm-muted">{solicitudes.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Solicitante", "Trámite", "Monto", "Estado", "Fecha"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {solicitudes.slice(0, 10).map((s) => {
                  const badge = { pendiente: "badge-yellow", aprobado: "badge-green", observado: "badge-blue", rechazado: "badge-red" } as Record<string, string>;
                  const label = { pendiente: "Pendiente", aprobado: "Aprobado", observado: "Observado", rechazado: "Rechazado" } as Record<string, string>;
                  return (
                    <tr key={s.id} className="border-t border-mcm-border hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-mcm-text">{s.nombres} {s.apellidos}</td>
                      <td className="py-3 px-4 text-mcm-muted text-xs max-w-[200px] truncate">{s.tipo_tramite}</td>
                      <td className="py-3 px-4 font-semibold text-mcm-text whitespace-nowrap">
                        {Number(s.monto_pagado) > 0 ? `S/ ${Number(s.monto_pagado).toLocaleString("es-PE")}` : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={badge[s.estado ?? "pendiente"]}>{label[s.estado ?? "pendiente"]}</span>
                      </td>
                      <td className="py-3 px-4 text-mcm-muted text-xs whitespace-nowrap">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString("es-PE", {
                          day: "2-digit", month: "short", year: "numeric",
                        }) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color, small }: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; color: string; small?: boolean;
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-2.5 rounded-xl shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-mcm-muted font-medium">{label}</p>
        <p className={`font-bold text-mcm-text mt-0.5 ${small ? "text-sm leading-tight" : "text-xl"}`}>{value}</p>
        <p className="text-xs text-mcm-muted mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportesPage() {
  return (
    <RouteGuard allowedRoles={["super_admin", "gestor"]}>
      <ReportesContent />
    </RouteGuard>
  );
}
