"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

// Mapa de redirección por email/rol
function getDestination(email: string, role: string): string {
  const adminEmails: Record<string, string> = {
    "admin@margaritacabrera.edu.pe":      "/dashboard",
    "staff@margaritacabrera.edu.pe":      "/dashboard/tramites-externos",
    "nvasquez@margaritacabrera.edu.pe":   "/dashboard/tramites-externos",
    "milnarvaez@margaritacabrera.edu.pe": "/dashboard/actualizacion",
  };
  return adminEmails[email.toLowerCase()] ?? (role === "alumno" ? "/portal" : "/dashboard");
}

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Si ya está autenticado (o acaba de loguearse), redirigir
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(getDestination(user.email, user.role));
    }
  }, [user, authLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      // No hacemos router.push aquí — el useEffect de arriba se encarga
      // cuando authLoading=false y user!=null
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credenciales incorrectas. Verifica tu correo y contraseña.");
      setSubmitting(false);
    }
    // No ponemos finally { setSubmitting(false) } porque queremos mantener
    // el botón deshabilitado hasta que el redirect ocurra
  }

  // Si auth está cargando y ya se envió el form, mostrar estado de carga
  const isLoading = submitting || (authLoading && !error);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(160deg, #a93526 0%, #8a2b1f 100%)" }}
    >
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-blanco.png"
            alt="I.E.S. Privada Margarita Cabrera"
            style={{ width: 300, height: "auto" }}
          />
          <p className="text-white/80 text-sm mt-3 tracking-wide">Portal Estudiantil</p>
        </div>

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
              <label className="block text-sm font-medium text-mcm-text mb-1.5">Correo institucional</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@margaritacabrera.edu.pe" required
                className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1.5">Contraseña</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                  className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mcm-muted hover:text-mcm-text">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading}
              className="w-full btn-primary py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
              {isLoading ? "Ingresando..." : "Ingresar al portal"}
            </button>
          </form>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">© 2026 I.E.S. Privada Margarita Cabrera</p>
      </div>
    </div>
  );
}
