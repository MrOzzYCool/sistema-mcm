"use client";

import { useState, useEffect, useCallback } from "react";
import RouteGuard from "@/components/RouteGuard";
import { supabase } from "@/lib/supabase";
import { Briefcase, FileText, Users, Send, Loader2 } from "lucide-react";
import clsx from "clsx";
import AdminOfertasTab from "@/components/bolsa-laboral/AdminOfertasTab";
import AdminSolicitudesTab from "@/components/bolsa-laboral/AdminSolicitudesTab";
import AdminPostulacionesTab from "@/components/bolsa-laboral/AdminPostulacionesTab";

type Tab = "ofertas" | "solicitudes" | "postulaciones";

function BolsaLaboralContent() {
  const [tab, setTab] = useState<Tab>("ofertas");
  const [pendientesCount, setPendientesCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(true);
  const [filterOfertaId, setFilterOfertaId] = useState<string | null>(null);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  const fetchPendientesCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/bolsa-laboral/solicitudes/pendientes-count", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendientesCount(data.count ?? 0);
      }
    } catch {
      // Silently fail — badge just won't show
    } finally {
      setLoadingCount(false);
    }
  }, []);

  useEffect(() => {
    fetchPendientesCount();
  }, [fetchPendientesCount]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "ofertas", label: "Ofertas", icon: <Briefcase size={14} className="inline mr-1.5" /> },
    { key: "solicitudes", label: "Solicitudes de Acceso", icon: <Users size={14} className="inline mr-1.5" />, badge: pendientesCount },
    { key: "postulaciones", label: "Postulaciones", icon: <Send size={14} className="inline mr-1.5" /> },
  ];

  return (
    <div className="p-6 w-full space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">Bolsa Laboral</h1>
        <p className="text-mcm-muted text-sm mt-0.5">Gestión de ofertas, solicitudes de acceso y postulaciones</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-mcm-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "px-4 py-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1",
              tab === t.key
                ? "border-[#C62828] text-[#C62828]"
                : "border-transparent text-mcm-muted hover:text-mcm-text"
            )}
          >
            {t.icon}
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="ml-1.5 bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "ofertas" && (
        <AdminOfertasTab
          onNavigatePostulaciones={(ofertaId) => {
            setFilterOfertaId(ofertaId);
            setTab("postulaciones");
          }}
        />
      )}
      {tab === "solicitudes" && <AdminSolicitudesTab onCountChange={fetchPendientesCount} />}
      {tab === "postulaciones" && (
        <AdminPostulacionesTab
          filterOfertaId={filterOfertaId}
          onClearFilter={() => setFilterOfertaId(null)}
        />
      )}
    </div>
  );
}

export default function BolsaLaboralAdminPage() {
  return (
    <RouteGuard allowedRoles={["super_admin"]}>
      <BolsaLaboralContent />
    </RouteGuard>
  );
}
