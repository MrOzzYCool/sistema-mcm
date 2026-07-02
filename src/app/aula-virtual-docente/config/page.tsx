"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Settings, Lock, User, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import clsx from "clsx";

type Tab = "perfil" | "contrasena";

export default function ConfigDocentePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("perfil");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Password form
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function handleChangePassword() {
    setError(""); setSuccess("");
    if (!currentPass) { setError("Ingrese su contraseña actual."); return; }
    if (newPass.length < 6) { setError("La nueva contraseña debe tener al menos 6 caracteres."); return; }
    if (newPass !== confirmPass) { setError("Las contraseñas no coinciden."); return; }

    setSaving(true);
    try {
      // Verify current password by signing in
      const email = user?.email;
      if (!email) throw new Error("No se pudo obtener tu email.");
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPass });
      if (signInError) throw new Error("La contraseña actual es incorrecta.");

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPass });
      if (updateError) throw new Error(updateError.message);

      setSuccess("Contraseña actualizada correctamente.");
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar contraseña");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="py-6 w-full max-w-2xl">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Configuración</h1>
      <p className="text-sm text-gray-500 mb-6">Ajustes de tu perfil y seguridad.</p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {([
          { id: "perfil" as Tab, label: "Mi Perfil", icon: User },
          { id: "contrasena" as Tab, label: "Contraseña", icon: Lock },
        ]).map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setError(""); setSuccess(""); }}
            className={clsx("flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === t.id ? "border-[#C62828] text-[#C62828]" : "border-transparent text-gray-500 hover:text-gray-700")}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm flex items-center gap-2 mb-4">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm flex items-center gap-2 mb-4">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {tab === "perfil" && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl"
              style={{ background: "#C62828" }}>
              {user?.avatar ?? "?"}
            </div>
            <div>
              <p className="font-bold text-gray-800 text-lg">{user?.name ?? "—"}</p>
              <p className="text-sm text-gray-500">{user?.email ?? "—"}</p>
              <span className="inline-block mt-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full capitalize">
                {user?.role ?? "docente"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre completo</label>
              <p className="text-sm text-gray-800 font-medium">{user?.name ?? "—"}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Correo institucional</label>
              <p className="text-sm text-gray-800 font-medium">{user?.email ?? "—"}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Rol</label>
              <p className="text-sm text-gray-800 font-medium capitalize">{user?.role ?? "—"}</p>
            </div>
          </div>

          <p className="text-xs text-gray-400 pt-3 border-t border-gray-100">
            Para modificar tus datos personales, contacta al administrador del sistema.
          </p>
        </div>
      )}

      {tab === "contrasena" && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Cambiar contraseña</h3>
            <p className="text-sm text-gray-500">Actualiza tu contraseña de acceso al sistema.</p>
          </div>

          <div className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
              <div className="relative">
                <input type={showCurrent ? "text" : "password"} value={currentPass}
                  onChange={e => setCurrentPass(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none pr-10" />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
              <div className="relative">
                <input type={showNew ? "text" : "password"} value={newPass}
                  onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 6 caracteres"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none pr-10" />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
              <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:outline-none" />
            </div>
            <button onClick={handleChangePassword} disabled={saving}
              className="px-5 py-2.5 bg-[#C62828] text-white rounded-lg text-sm font-semibold hover:bg-[#8E0000] transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
