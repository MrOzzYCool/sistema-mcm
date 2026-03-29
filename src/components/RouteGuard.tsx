"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, AppUser } from "@/lib/auth-context";
import { ShieldOff } from "lucide-react";

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles: AppUser["role"][];
  redirectTo?: string;
}

export default function RouteGuard({
  children,
  allowedRoles,
  redirectTo = "/dashboard/tramites-externos",
}: RouteGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const allowed = !loading && user && allowedRoles.includes(user.role);

  useEffect(() => {
    if (!loading && user && !allowedRoles.includes(user.role)) {
      router.replace(redirectTo);
    }
  }, [loading, user, allowedRoles, redirectTo, router]);

  if (loading) return null;

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <ShieldOff className="w-8 h-8 text-[#a93526]" />
        </div>
        <h2 className="text-xl font-bold text-mcm-text mb-2">Acceso denegado</h2>
        <p className="text-mcm-muted text-sm max-w-xs">
          No tienes permisos para ver esta sección. Serás redirigido automáticamente.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
