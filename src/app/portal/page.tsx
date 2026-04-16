"use client";

import { useAuth } from "@/lib/auth-context";
import { Calendar, BookOpen, CreditCard, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function PortalInicio() {
  const { user } = useAuth();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">
          Bienvenido, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-mcm-muted text-sm mt-0.5">{user?.email}</p>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickCard href="/portal/calendario" icon={<Calendar size={22} />} label="Calendario" sub="Clases y evaluaciones" color="bg-blue-50 text-blue-600" />
        <QuickCard href="/portal/cursos"     icon={<BookOpen size={22} />}  label="Mis Cursos" sub="Notas y avance"       color="bg-green-50 text-green-600" />
        <QuickCard href="/portal/pagos"      icon={<CreditCard size={22} />} label="Pagos"     sub="Estado de cuenta"     color="bg-yellow-50 text-yellow-600" />
        <QuickCard href="/portal/tramites"   icon={<FileText size={22} />}  label="Trámites"   sub="Solicitudes y becas"  color="bg-red-50 text-red-600" />
      </div>

      {/* Avisos */}
      <div className="card">
        <h2 className="font-semibold text-mcm-text mb-3">Avisos recientes</h2>
        <div className="space-y-3">
          <Aviso tipo="info" titulo="Inicio de clases" desc="El semestre 2026-I inicia el 14 de abril." />
          <Aviso tipo="warning" titulo="Matrícula" desc="Recuerda completar tu matrícula antes del 10 de abril." />
        </div>
      </div>
    </div>
  );
}

function QuickCard({ href, icon, label, sub, color }: {
  href: string; icon: React.ReactNode; label: string; sub: string; color: string;
}) {
  return (
    <Link href={href} className="card hover:shadow-md transition-shadow flex items-start gap-4 group">
      <div className={`p-2.5 rounded-xl shrink-0 ${color}`}>{icon}</div>
      <div className="flex-1">
        <p className="font-semibold text-mcm-text text-sm">{label}</p>
        <p className="text-xs text-mcm-muted mt-0.5">{sub}</p>
      </div>
      <ArrowRight size={14} className="text-mcm-muted mt-1 group-hover:text-mcm-text transition-colors" />
    </Link>
  );
}

function Aviso({ tipo, titulo, desc }: { tipo: "info" | "warning"; titulo: string; desc: string }) {
  const styles = {
    info:    "bg-blue-50 border-blue-200 text-blue-700",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
  };
  return (
    <div className={`border rounded-xl p-3.5 text-sm ${styles[tipo]}`}>
      <p className="font-medium">{titulo}</p>
      <p className="text-xs mt-0.5 opacity-80">{desc}</p>
    </div>
  );
}
