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
    // Acortar el nombre para que quepa en el eje X
    const nombre = s.tipo_tramite
      .replace(/\(Alumnas que estudiaron.*?\)/gi, "")
      .replace(/INSTITUTO/gi, "")
      .trim()
      .slice(0, 22);
    map[nombre] = (map[nombre] ?? 0) + 1;
  }
  return Object.entries(map)
    .map(([tipo, cantidad]) => ({ tipo, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 8); // top 8
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function agruparIngresosPorMes(solicitudes: SolicitudDB[]) {
  const map: Record<string, number> = {};
  for (const s of solicitudes) {
    if (s.estado !== "aprobado" || !s.created_at) continue;
    const d   = new Date(s.created_at);
    const key = `${MESES[d.getMonth()]} ${d.getFullYear()}`;
    map[key]  = (map[key] ?? 0) + Number(s.monto_pagado);
  }
  // Ordenar cronológicamente
  return Object.entries(map)
    .map(([mes, total]) => ({ mes, total }))
    .sort((a, b) => {
      const [mA, yA] = a.mes.split(" ");
      const [mB, yB] = b.mes.split(" ");
      return Number(yA) !== Number(yB)
        ? Number(yA) - Number(yB)
        : MESES.indexOf(mA) - MESES.indexOf(mB);
    });
}

// ─── Contenido principal ──────────────────────────────────────────────────────

function ReportesContent() {
  const [solicitudes, setSolicitudes] = useState<SolicitudDB[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [refreshKey, setRefreshKey]   = useState(0);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getSolicitudes();
      setSolicitudes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar, refreshKey]);

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const totalRecaudado = solicitudes
    .filter((s) => s.estado === "aprobado")
    .reduce((acc, s) => acc + Number(s.monto_pagado), 0);

  const pendientes  = solicitudes.filter((s) => s.estado === "pendiente").length;
  const completados = solicitudes.filter((s) => s.estado === "aprobado").length;
  const observados  = solicitudes.filter((s) => s.estado === "observado").length;

  // ─── Datos para gráficos ───────────────────────────────────────────────────
  const datosPorTipo   = agruparPorTipo(solicitudes);
  const datosIngresos  = agruparIngresosPorMes(solicitudes);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Reportes y Estadísticas</h1>
          <p className="text-mcm-muted text-sm mt-0.5">Datos en tiempo real desde Supabase</p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refrescar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total recaudado"      value={loading ? "…" : `S/ ${totalRecaudado.toLocaleString()}`} icon={<DollarSign size={20} />} color="bg-green-50 text-green-600" />
        <KpiCard label="Pendientes"           value={loading ? "…" : String(pendientes)}  icon={<Clock size={20} />}       color="bg-yellow-50 text-yellow-600" />
        <KpiCard label="Completados"          value={loading ? "…" : String(completados)} icon={<CheckCircle size={20} />} color="bg-blue-50 text-blue-600" />
        <KpiCard label="Con observación"      value={loading ? "…" : String(observados)}  icon={<TrendingUp size={20} />}  color="bg-red-50 text-red-600" />
      </div>

      {/* Gráficos */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-mcm-muted">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-sm">Cargando datos...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Barras: trámites por tipo */}
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

          {/* Línea: ingresos por mes */}
          <div className="card">
            <h2 className="font-semibold text-mcm-text mb-1">Ingresos por mes (S/)</h2>
            <p className="text-xs text-mcm-muted mb-4">Solo solicitudes aprobadas</p>
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
                    formatter={(v) => [`S/ ${Number(v).toLocaleString()}`, "Ingresos"]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone" dataKey="total" name="Ingresos"
                    stroke="#a93526" strokeWidth={2.5}
                    dot={{ fill: "#a93526", r: 4 }} activeDot={{ r: 6 }}
                  />
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
                  const estadoBadge = { pendiente: "badge-yellow", aprobado: "badge-green", observado: "badge-blue", rechazado: "badge-red" } as Record<string, string>;
                  const estadoLabel = { pendiente: "Pendiente", aprobado: "Aprobado", observado: "Observado", rechazado: "Rechazado" } as Record<string, string>;
                  return (
                    <tr key={s.id} className="border-t border-mcm-border hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-mcm-text">{s.nombres} {s.apellidos}</td>
                      <td className="py-3 px-4 text-mcm-muted text-xs max-w-[200px] truncate">{s.tipo_tramite}</td>
                      <td className="py-3 px-4 font-semibold text-mcm-text whitespace-nowrap">
                        {Number(s.monto_pagado) > 0 ? `S/ ${Number(s.monto_pagado).toLocaleString()}` : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={estadoBadge[s.estado ?? "pendiente"]}>{estadoLabel[s.estado ?? "pendiente"]}</span>
                      </td>
                      <td className="py-3 px-4 text-mcm-muted text-xs whitespace-nowrap">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
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

function KpiCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-2.5 rounded-xl shrink-0 ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-mcm-muted font-medium">{label}</p>
        <p className="text-xl font-bold text-mcm-text mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function ReportesPage() {
  return (
    <RouteGuard allowedRoles={["super_admin", "gestor"]}>
      <ReportesContent />
    </RouteGuard>
  );
}
