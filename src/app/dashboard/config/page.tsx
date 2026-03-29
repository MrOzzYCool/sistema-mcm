"use client";

import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { User, Lock, Bell, Shield } from "lucide-react";

export default function ConfigPage() {
  const { user } = useAuth();
  const [notifPagos, setNotifPagos]     = useState(true);
  const [notifTramites, setNotifTramites] = useState(true);
  const [notifEmail, setNotifEmail]     = useState(false);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">Configuración</h1>
        <p className="text-mcm-muted text-sm mt-0.5">Gestiona tu perfil y preferencias</p>
      </div>

      {/* Perfil */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-mcm-muted" />
          <h2 className="font-semibold text-mcm-text">Información personal</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-mcm-primary rounded-2xl flex items-center justify-center text-white font-bold text-xl">
            {user?.avatar}
          </div>
          <div>
            <p className="font-semibold text-mcm-text">{user?.name}</p>
            <p className="text-sm text-mcm-muted">{user?.email}</p>
            <p className="text-xs text-mcm-muted mt-0.5 capitalize">{user?.role}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-mcm-text mb-1.5">Nombre completo</label>
            <input defaultValue={user?.name} className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-mcm-text mb-1.5">Correo institucional</label>
            <input defaultValue={user?.email} disabled className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm bg-slate-50 text-mcm-muted cursor-not-allowed" />
          </div>
        </div>
        <button className="btn-primary text-sm">Guardar cambios</button>
      </div>

      {/* Contraseña */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="w-4 h-4 text-mcm-muted" />
          <h2 className="font-semibold text-mcm-text">Cambiar contraseña</h2>
        </div>
        <div className="space-y-3">
          {["Contraseña actual", "Nueva contraseña", "Confirmar nueva contraseña"].map((label) => (
            <div key={label}>
              <label className="block text-sm font-medium text-mcm-text mb-1.5">{label}</label>
              <input type="password" placeholder="••••••••" className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary" />
            </div>
          ))}
        </div>
        <button className="btn-primary text-sm">Actualizar contraseña</button>
      </div>

      {/* Notificaciones */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-mcm-muted" />
          <h2 className="font-semibold text-mcm-text">Notificaciones</h2>
        </div>
        <div className="space-y-3">
          <Toggle label="Alertas de vencimiento de pagos" checked={notifPagos} onChange={setNotifPagos} />
          <Toggle label="Actualizaciones de trámites" checked={notifTramites} onChange={setNotifTramites} />
          <Toggle label="Notificaciones por correo" checked={notifEmail} onChange={setNotifEmail} />
        </div>
      </div>

      {/* Seguridad */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-mcm-muted" />
          <h2 className="font-semibold text-mcm-text">Seguridad</h2>
        </div>
        <p className="text-sm text-mcm-muted">
          Última sesión iniciada: <span className="text-mcm-text font-medium">Hoy, 09:32 a.m.</span>
        </p>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-mcm-text">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? "bg-mcm-primary" : "bg-gray-200"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}
