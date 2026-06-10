"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, BookOpen, FileText, ClipboardList,
  LogOut, ChevronRight, Moon, Sun, ArrowLeftRight,
} from "lucide-react";
import clsx from "clsx";
import { useTheme } from "@/lib/theme-context";

const NAV_ITEMS = [
  { href: "/aula-virtual",        label: "Mis Cursos",    icon: LayoutDashboard },
  { href: "/aula-virtual/tareas", label: "Tareas",        icon: ClipboardList   },
  { href: "/aula-virtual/foros",  label: "Foros",         icon: FileText        },
  { href: "/aula-virtual/notas",  label: "Notas",         icon: BookOpen        },
];

export default function SidebarAulaVirtual() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <aside
      className="w-64 min-h-screen flex flex-col shrink-0"
      style={{ background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)" }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center px-5 py-5 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-blanco.png" alt="I.E.S. Privada Margarita Cabrera"
          style={{ width: 90, height: "auto" }} />
        <p className="text-white/70 text-xs mt-2 text-center leading-tight">
          Aula Virtual
        </p>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href ||
            (href !== "/aula-virtual" && pathname.startsWith(href + "/"));
          return (
            <Link key={href} href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active
                  ? "bg-white shadow-sm"
                  : "text-white/80 hover:bg-white/15 hover:text-white"
              )}
              style={active ? { color: "#1e293b" } : {}}>
              <Icon size={18} className="shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} style={{ color: "#1e293b" }} />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 pb-5 space-y-1">
        <Link href="/seleccionar"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150">
          <ArrowLeftRight size={18} />
          <span>Cambiar módulo</span>
        </Link>
        <button onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150">
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
        </button>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150">
          <LogOut size={18} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
