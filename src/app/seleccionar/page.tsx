"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export default function SeleccionarModulo() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/");
    else if (user.forcePasswordReset) router.replace("/cambiar-contrasena");
    else if (user.role !== "alumno") router.replace("/dashboard");
    else router.replace("/portal");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg,#C62828 0%,#8E0000 100%)" }}>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-blanco.png" alt="Logo" style={{ width: 80, height: "auto", margin: "0 auto 16px" }} />
          <Loader2 size={20} className="text-white/70 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return null;
}
