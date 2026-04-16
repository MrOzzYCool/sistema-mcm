"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      // Redirigir según rol
      const { supabase } = await import("@/lib/supabase");
      const { data: { user } } = await supabase.auth.getUser();
      const rolMap: Record<string, string> = {
        "milnarvaez@margaritacabrera.edu.pe": "/dashboard/actualizacion",
      };
      const userEmail = user?.email?.toLowerCase() ?? "";
      const defaultDest = userEmail.endsWith("@margaritacabrera.edu.pe") && !rolMap[userEmail]
        ? "/portal"
        : "/dashboard/tramites-externos";
      const dest = rolMap[userEmail] ?? defaultDest;
      router.push(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credenciales incorrectas. Verifica tu correo y contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(160deg, #a93526 0%, #8a2b1f 100%)" }}
    >
      <div className="w-full max-w-md">

        {/* Logo blanco centrado */}
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-blanco.png"
            alt="I.E.S. Privada Margarita Cabrera"
            style={{ width: 300, height: "auto" }}
          />
          <p className="text-white/80 text-sm mt-3 tracking-wide">Portal Estudiantil</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-mcm-text mb-1">Iniciar sesión</h2>
          <p className="text-mcm-muted text-sm mb-6">Ingresa con tu cuenta institucional</p>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-5 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1.5">
                Correo institucional
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@margaritacabrera.edu.pe"
                required
                className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mcm-muted hover:text-mcm-text"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Ingresando..." : "Ingresar al portal"}
            </button>
          </form>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          © 2026 I.E.S. Privada Margarita Cabrera
        </p>
      </div>
    </div>
  );
}
