"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, Calendar, BookOpen, CreditCard,
  FileText, LogOut, ChevronRight,
} from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/portal",            label: "Inicio",      icon: LayoutDashboard },
  { href: "/portal/calendario", label: "Calendario",  icon: Calendar        },
  { href: "/portal/cursos",     label: "Cursos",      icon: BookOpen        },
  { href: "/portal/pagos",      label: "Pagos",       icon: CreditCard      },
  { href: "/portal/tramites",   label: "Trámites",    icon: FileText        },
];

export default function SidebarAlumno() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <aside
      className="w-64 min-h-screen flex flex-col shrink-0"
      style={{ background: "linear-gradient(180deg, #a93526 0%, #8a2b1f 100%)" }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center px-5 py-5 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-blanco.png" alt="I.E.S. Privada Margarita Cabrera"
          style={{ width: 90, height: "auto" }} />
        <p className="text-white/70 text-xs mt-2 text-center leading-tight">
          Portal Estudiantil
        </p>
      </div>

      {/* Perfil */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: "#c45648" }}>
            {user?.avatar ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-white/60 text-xs">Alumno</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href ||
            (href !== "/portal" && pathname.startsWith(href + "/"));
          return (
            <Link key={href} href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active
                  ? "bg-white shadow-sm"
                  : "text-white/80 hover:bg-white/15 hover:text-white"
              )}
              style={active ? { color: "#8a2b1f" } : {}}>
              <Icon size={18} className="shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} style={{ color: "#8a2b1f" }} />}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150">
          <LogOut size={18} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
