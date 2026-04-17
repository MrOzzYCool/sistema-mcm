"use client";

import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useCallback } from "react";
import {
  MOCK_PAGOS, MOCK_TRAMITES, MOCK_AVISOS,
  calcularDeuda, formatMonto, formatFecha,
} from "@/lib/mock-data";
import {
  CreditCard, FileText, AlertTriangle, CheckCircle,
  Clock, TrendingUp, Bell, ArrowRight, Users, UserCog,
  BookOpen, BarChart2, Loader2,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { EstadoBadge } from "@/components/EstadoBadge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

const ADMIN_ROLES = ["super_admin", "staff_tramites", "gestor", "actualizacion"];

/** Formatea timestamps ISO de Supabase a "17 abr. 2025" */
function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role && ADMIN_ROLES.includes(user.role);
  return isAdmin ? <AdminDashboard /> : <AlumnoDashboard />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD ADMINISTRATIVO
// ═══════════════════════════════════════════════════════════════════════════════

interface AdminStats {
  totalAlumnos: number;
  totalProfesores: number;
  tramitesPendientes: number;
  recaudacionMes: number;
}

interface TramiteReciente {
  id: string;
  nombres: string;
  apellidos: string;
  tipo_tramite: string;
  monto_pagado: number;
  estado: string;
  created_at: string;
}

interface MesData {
  mes: string;
  ingresos: number;
}

function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats>({ totalAlumnos: 0, totalProfesores: 0, tramitesPendientes: 0, recaudacionMes: 0 });
  const [tramites, setTramites] = useState<TramiteReciente[]>([]);
  const [chartData, setChartData] = useState<MesData[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      // Alumnos totales
      const { count: alumnos } = await supabase
        .from("profiles").select("id", { count: "exact", head: true }).eq("rol", "alumno").eq("estado", "activo");

      // Profesores totales
      const { count: profesores } = await supabase
        .from("profiles").select("id", { count: "exact", head: true }).eq("rol", "profesor").eq("estado", "activo");

      // Trámites pendientes
      const { count: pendientes } = await supabase
        .from("solicitudes").select("id", { count: "exact", head: true }).eq("estado", "pendiente");

      // Recaudación del mes
      const now = new Date();
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: aprobados } = await supabase
        .from("solicitudes").select("monto_pagado").eq("estado", "aprobado").gte("created_at", inicioMes);
      const recaudacion = (aprobados ?? []).reduce((sum, s) => sum + (Number(s.monto_pagado) || 0), 0);

      setStats({
        totalAlumnos: alumnos ?? 0,
        totalProfesores: profesores ?? 0,
        tramitesPendientes: pendientes ?? 0,
        recaudacionMes: recaudacion,
      });

      // Últimos 10 trámites
      const { data: ultimos } = await supabase
        .from("solicitudes")
        .select("id, nombres, apellidos, tipo_tramite, monto_pagado, estado, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      setTramites(ultimos ?? []);

      // Datos para gráfico: ingresos de los últimos 6 meses
      const meses: MesData[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const fin = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const label = d.toLocaleDateString("es-PE", { month: "short" }).replace(".", "");
        const { data: mesData } = await supabase
          .from("solicitudes")
          .select("monto_pagado")
          .eq("estado", "aprobado")
          .gte("created_at", d.toISOString())
          .lt("created_at", fin.toISOString());
        const total = (mesData ?? []).reduce((s, r) => s + (Number(r.monto_pagado) || 0), 0);
        meses.push({ mes: label.charAt(0).toUpperCase() + label.slice(1), ingresos: total });
      }
      setChartData(meses);

    } catch (err) {
      console.error("Error cargando dashboard admin:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const handler = () => { if (document.visibilityState === "visible") cargar(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [cargar]);

  return (
    <div className="p-6 w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">Panel Administrativo</h1>
        <p className="text-mcm-muted text-sm mt-0.5">
          Bienvenido, {user?.name.split(" ")[0]} · {user?.email}
        </p>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted">
          <Loader2 size={20} className="animate-spin" /> <span className="text-sm">Cargando estadísticas...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <KpiCard label="Alumnos Activos" value={String(stats.totalAlumnos)}
              icon={<Users className="w-6 h-6" />} color="blue" sub="Matriculados" />
            <KpiCard label="Profesores" value={String(stats.totalProfesores)}
              icon={<UserCog className="w-6 h-6" />} color="green" sub="Activos en el sistema" />
            <KpiCard label="Trámites Pendientes" value={String(stats.tramitesPendientes)}
              icon={<Clock className="w-6 h-6" />} color="yellow" sub="Por revisar" />
            <KpiCard label="Recaudación del Mes" value={formatMonto(stats.recaudacionMes)}
              icon={<TrendingUp className="w-6 h-6" />} color="red"
              sub={new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" })} />
          </div>

          {/* Gráfico + Accesos directos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de tendencia */}
            <div className="lg:col-span-2 card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-mcm-muted" />
                  <h2 className="font-semibold text-mcm-text">Tendencia de Ingresos</h2>
                </div>
                <span className="text-xs text-mcm-muted">Últimos 6 meses</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} tickFormatter={(v) => `S/${v}`} />
                    <Tooltip
                      formatter={(value) => [`S/ ${Number(value).toFixed(2)}`, "Ingresos"]}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                    />
                    <Bar dataKey="ingresos" fill="#a93526" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Accesos directos — cards de acción */}
            <div className="space-y-4">
              <h2 className="font-semibold text-mcm-text">Accesos Directos</h2>
              <ActionCard href="/dashboard/usuarios" icon={<Users size={22} />}
                label="Gestión de Usuarios" desc="Crear, editar y administrar cuentas" />
              <ActionCard href="/dashboard/reportes" icon={<BarChart2 size={22} />}
                label="Reportes" desc="Analítica de ingresos y trámites" />
              <ActionCard href="/dashboard/academico" icon={<BookOpen size={22} />}
                label="Malla Curricular" desc="Carreras, cursos y asignaciones" />
              <ActionCard href="/dashboard/tramites-externos" icon={<FileText size={22} />}
                label="Gestión de Trámites" desc="Revisar y aprobar solicitudes" />
            </div>
          </div>

          {/* Tabla de últimos trámites */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-mcm-muted" />
                <h2 className="font-semibold text-mcm-text">Últimos Trámites</h2>
              </div>
              <Link href="/dashboard/tramites-externos" className="text-sm text-mcm-primary hover:underline flex items-center gap-1">
                Ver todos <ArrowRight size={14} />
              </Link>
            </div>
            {tramites.length === 0 ? (
              <p className="text-sm text-mcm-muted py-8 text-center">Sin trámites recientes</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mcm-border">
                      {["Solicitante", "Tipo", "Monto", "Estado", "Fecha"].map(h => (
                        <th key={h} className="text-left py-2.5 px-3 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tramites.map(t => (
                      <tr key={t.id} className="border-b border-mcm-border last:border-0 hover:bg-slate-50">
                        <td className="py-3 px-3 font-medium text-mcm-text text-xs">{t.nombres} {t.apellidos}</td>
                        <td className="py-3 px-3 text-mcm-muted text-xs max-w-[200px] truncate">{t.tipo_tramite}</td>
                        <td className="py-3 px-3 font-mono text-xs">{formatMonto(Number(t.monto_pagado))}</td>
                        <td className="py-3 px-3"><EstadoBadge estado={t.estado} /></td>
                        <td className="py-3 px-3 text-mcm-muted text-xs">{formatTimestamp(t.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD ALUMNO (sin cambios, usa mock data)
// ═══════════════════════════════════════════════════════════════════════════════

const AVISO_STYLES = {
  danger:  { bg: "bg-red-50 border-red-200",       dot: "bg-red-500"    },
  warning: { bg: "bg-yellow-50 border-yellow-200",  dot: "bg-yellow-500" },
  info:    { bg: "bg-blue-50 border-blue-200",      dot: "bg-blue-500"   },
};

function AlumnoDashboard() {
  const { user } = useAuth();
  const deudaTotal    = calcularDeuda(MOCK_PAGOS);
  const pagosVencidos = MOCK_PAGOS.filter((p) => p.estado === "vencido").length;
  const tramitesPend  = MOCK_TRAMITES.filter((t) => t.estado === "pendiente" || t.estado === "en_proceso").length;
  const tramitesOk    = MOCK_TRAMITES.filter((t) => t.estado === "aprobado").length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">Bienvenido, {user?.name.split(" ")[0]} 👋</h1>
        <p className="text-mcm-muted text-sm mt-0.5">{user?.email}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Deuda Total" value={formatMonto(deudaTotal)} icon={<CreditCard className="w-5 h-5" />}
          color="red" sub={`${pagosVencidos} cuota${pagosVencidos !== 1 ? "s" : ""} vencida${pagosVencidos !== 1 ? "s" : ""}`} />
        <SummaryCard label="Cuotas Pagadas" value={`${MOCK_PAGOS.filter((p) => p.estado === "pagado").length} / ${MOCK_PAGOS.length}`}
          icon={<CheckCircle className="w-5 h-5" />} color="green" sub="Al día" />
        <SummaryCard label="Trámites Activos" value={String(tramitesPend)} icon={<Clock className="w-5 h-5" />} color="yellow" sub="En proceso" />
        <SummaryCard label="Trámites Completados" value={String(tramitesOk)} icon={<TrendingUp className="w-5 h-5" />} color="blue" sub="Disponibles" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-mcm-muted" />
            <h2 className="font-semibold text-mcm-text">Avisos y alertas</h2>
          </div>
          <div className="space-y-3">
            {MOCK_AVISOS.map((aviso) => {
              const s = AVISO_STYLES[aviso.tipo];
              return (
                <div key={aviso.id} className={clsx("flex gap-3 border rounded-xl p-3.5", s.bg)}>
                  <div className={clsx("w-2 h-2 rounded-full mt-1.5 shrink-0", s.dot)} />
                  <div>
                    <p className="text-sm font-medium text-mcm-text">{aviso.titulo}</p>
                    <p className="text-xs text-mcm-muted mt-0.5">{aviso.descripcion}</p>
                    <p className="text-xs text-mcm-muted mt-1">{formatFecha(aviso.fecha)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-mcm-text">Accesos rápidos</h2>
          <div className="space-y-2">
            <QuickLink href="/dashboard/pagos" icon={<CreditCard size={16} />} label="Ver estado de cuenta" />
            <QuickLink href="/dashboard/tramites" icon={<FileText size={16} />} label="Solicitar trámite" />
            <QuickLink href="/dashboard/tramites" icon={<AlertTriangle size={16} />} label="Trámites pendientes" />
          </div>
          <div className="mt-4 pt-4 border-t border-mcm-border">
            <p className="text-xs font-medium text-mcm-muted mb-2">Próximo vencimiento</p>
            {(() => {
              const prox = MOCK_PAGOS.find((p) => p.estado === "pendiente");
              return prox ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <p className="text-sm font-semibold text-mcm-text">{prox.concepto}</p>
                  <p className="text-xs text-mcm-muted mt-0.5">{formatFecha(prox.vencimiento)}</p>
                  <p className="text-base font-bold text-yellow-700 mt-1">{formatMonto(prox.monto)}</p>
                </div>
              ) : (
                <p className="text-sm text-green-600 font-medium">Sin vencimientos próximos</p>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES COMPARTIDOS
// ═══════════════════════════════════════════════════════════════════════════════

function KpiCard({ label, value, icon, color, sub }: {
  label: string; value: string; icon: React.ReactNode; color: "red"|"green"|"yellow"|"blue"; sub: string;
}) {
  const styles = {
    red:    { bg: "bg-red-50",    text: "text-red-600",    border: "border-l-red-500"    },
    green:  { bg: "bg-green-50",  text: "text-green-600",  border: "border-l-green-500"  },
    yellow: { bg: "bg-yellow-50", text: "text-yellow-600", border: "border-l-yellow-500" },
    blue:   { bg: "bg-blue-50",   text: "text-blue-600",   border: "border-l-blue-500"   },
  };
  const s = styles[color];
  return (
    <div className={clsx("card flex items-start gap-4 border-l-4 py-5 px-5", s.border)}>
      <div className={clsx("p-3 rounded-xl shrink-0", s.bg, s.text)}>{icon}</div>
      <div>
        <p className="text-xs text-mcm-muted font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-mcm-text mt-1">{value}</p>
        <p className="text-xs text-mcm-muted mt-1">{sub}</p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, color, sub }: {
  label: string; value: string; icon: React.ReactNode; color: "red"|"green"|"yellow"|"blue"; sub: string;
}) {
  const colors = {
    red:    "bg-red-50 text-red-600",
    green:  "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    blue:   "bg-blue-50 text-blue-600",
  };
  return (
    <div className="card flex items-start gap-4">
      <div className={clsx("p-2.5 rounded-xl shrink-0", colors[color])}>{icon}</div>
      <div>
        <p className="text-xs text-mcm-muted font-medium">{label}</p>
        <p className="text-xl font-bold text-mcm-text mt-0.5">{value}</p>
        <p className="text-xs text-mcm-muted mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function ActionCard({ href, icon, label, desc }: {
  href: string; icon: React.ReactNode; label: string; desc: string;
}) {
  return (
    <Link href={href}
      className="flex items-center gap-4 p-4 rounded-xl border border-mcm-border hover:border-[#a93526]/30 hover:bg-red-50/30 transition-all group">
      <div className="p-3 rounded-xl bg-red-50 text-[#a93526] group-hover:bg-[#a93526] group-hover:text-white transition-colors shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-mcm-text">{label}</p>
        <p className="text-xs text-mcm-muted mt-0.5">{desc}</p>
      </div>
      <ArrowRight size={16} className="text-mcm-muted ml-auto shrink-0 group-hover:text-[#a93526] transition-colors" />
    </Link>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 border border-mcm-border transition-colors text-sm text-mcm-text font-medium">
      <span className="text-mcm-primary">{icon}</span>
      <span className="flex-1">{label}</span>
      <ArrowRight size={14} className="text-mcm-muted" />
    </Link>
  );
}
