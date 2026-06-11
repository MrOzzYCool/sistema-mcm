"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, Calendar, BookOpen, CreditCard,
  FileText, LogOut, Moon, Sun, ArrowLeftRight,
  Menu, X, Mail, Library,
} from "lucide-react";
import clsx from "clsx";
import { useTheme } from "@/lib/theme-context";

const NAV_ITEMS = [
  { href: "/portal",            label: "Inicio",      icon: LayoutDashboard },
  { href: "/portal/calendario", label: "Calendario",  icon: Calendar        },
  { href: "/portal/cursos",     label: "Cursos",      icon: BookOpen        },
  { href: "/portal/pagos",      label: "Pagos",       icon: CreditCard      },
  { href: "/portal/tramites",   label: "Trámites",    icon: FileText        },
];

export default function SidebarAlumno() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  // Collapsed state (icon-only bar)
  if (!expanded) {
    return (
      <aside className="w-16 min-h-screen flex flex-col items-center shrink-0 py-4 bg-[#C62828]">
        {/* Logo */}
        <div className="mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-blanco.png" alt="MC" className="w-9 h-9 object-contain" />
        </div>

        {/* Menu toggle */}
        <button onClick={() => setExpanded(true)} className="text-white/80 hover:text-white mb-6 transition-colors">
          <Menu size={22} />
        </button>

        {/* Nav icons */}
        <nav className="flex-1 flex flex-col items-center gap-2">
          {NAV_ITEMS.map(({ href, icon: Icon }) => {
            const active = pathname === href || (href !== "/portal" && pathname.startsWith(href + "/"));
            return (
              <Link key={href} href={href}
                className={clsx(
                  "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
                  active ? "bg-white/20 text-white" : "text-white/60 hover:text-white hover:bg-white/10"
                )}>
                <Icon size={20} />
              </Link>
            );
          })}
        </nav>

        {/* Bottom icons */}
        <div className="flex flex-col items-center gap-2 mt-auto pt-4 border-t border-white/20">
          <Link href="/seleccionar" className="w-10 h-10 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all">
            <ArrowLeftRight size={18} />
          </Link>
          <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    );
  }

  // Expanded state
  return (
    <aside className="w-64 min-h-screen flex flex-col shrink-0 bg-[#C62828]">
      {/* Header: Logo + Close */}
      <div className="flex flex-col items-center px-5 py-5 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-blanco.png" alt="I.E.S. Privada Margarita Cabrera" className="w-20 h-auto" />
        <p className="text-white/70 text-[10px] mt-1.5 text-center leading-tight">
          I.E.S. Privada<br />MARGARITA CABRERA
        </p>
      </div>

      {/* Close button */}
      <button onClick={() => setExpanded(false)} className="self-start mx-4 mt-3 text-white/70 hover:text-white transition-colors">
        <X size={20} />
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/portal" && pathname.startsWith(href + "/"));
          return (
            <Link key={href} href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active ? "bg-white/20 text-white border-r-4 border-white" : "text-white/80 hover:bg-white/10 hover:text-white"
              )}>
              <Icon size={18} className="shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 pb-5 space-y-1 border-t border-white/10 pt-3">
        <Link href="/seleccionar"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all">
          <ArrowLeftRight size={18} /> <span>Cambiar módulo</span>
        </Link>
        <button onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all">
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
        </button>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all">
          <LogOut size={18} /> <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
