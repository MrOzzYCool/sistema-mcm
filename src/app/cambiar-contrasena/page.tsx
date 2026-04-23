"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, AlertCircle, Lock } from "lucide-react";

export default function CambiarContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const match = password === confirm;
  const valid = password.length >= 6 && match;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError("Sesión no disponible"); setSaving(false); return; }

      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      // Force auth to re-resolve user (flag is now false)
      // Sign out and back in to refresh the user state
      await supabase.auth.signOut();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar contraseña");
    } finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(160deg, #a93526 0%, #8a2b1f 100%)" }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-blanco.png" alt="Logo" style={{ width: 200, height: "auto" }} />
          <p className="text-white/80 text-sm mt-3">Cambio de contraseña obligatorio</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600"><Lock size={20} /></div>
            <div>
              <h2 className="text-lg font-bold text-mcm-text">Nueva contraseña</h2>
              <p className="text-mcm-muted text-xs">Debes cambiar tu contraseña antes de continuar</p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-5 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1.5">Nueva contraseña</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required
                  className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mcm-muted hover:text-mcm-text">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && password.length < 6 && (
                <p className="text-red-500 text-xs mt-1">Mínimo 6 caracteres</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1.5">Repetir contraseña</label>
              <input type={showPw ? "text" : "password"} value={confirm}
                onChange={e => setConfirm(e.target.value)} placeholder="Repite tu nueva contraseña" required
                className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary" />
              {confirm && !match && (
                <p className="text-red-500 text-xs mt-1">Las contraseñas no coinciden</p>
              )}
              {confirm && match && password.length >= 6 && (
                <p className="text-green-600 text-xs mt-1">✓ Las contraseñas coinciden</p>
              )}
            </div>

            <button type="submit" disabled={saving || !valid}
              className="w-full btn-primary py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
