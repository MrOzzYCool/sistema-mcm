"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, Upload, ClipboardList, BookOpen,
  LogOut, Moon, Sun, ArrowLeftRight, Menu, X, Settings,
} from "lucide-react";
import clsx from "clsx";
import { useTheme } from "@/lib/theme-context";

const NAV_ITEMS = [
  { href: "/aula-virtual-docente",            label: "Mis Cursos",   icon: LayoutDashboard },
  { href: "/aula-virtual-docente/contenido",  label: "Contenido",    icon: Upload          },
  { href: "/aula-virtual-docente/tareas",     label: "Tareas",       icon: ClipboardList   },
  { href: "/aula-virtual-docente/notas",      label: "Notas",        icon: BookOpen        },
  { href: "/aula-virtual-docente/config",     label: "Configuración",icon: Settings        },
];

export default function SidebarDocenteAV() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  if (!expanded) {
    return (
      <aside className="w-16 min-h-screen flex flex-col items-center shrink-0 py-4 bg-[#C62828] transition-all duration-300">
        <div className="mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mc-icon.png" alt="MC" className="w-10 h-10 object-contain" />
        </div>
        <button onClick={() => setExpanded(true)} className="text-white/80 hover:text-white mb-6 transition-colors">
          <Menu size={22} />
        </button>
        <nav className="flex-1 flex flex-col items-center gap-2">
          {NAV_ITEMS.map(({ href, icon: Icon }) => {
            const active = pathname === href || (href !== "/aula-virtual-docente" && pathname.startsWith(href + "/"));
            return (
              <Link key={href} href={href}
                className={clsx("w-10 h-10 flex items-center justify-center rounded-xl transition-all",
                  active ? "bg-white/20 text-white" : "text-white/60 hover:text-white hover:bg-white/10")}>
                <Icon size={20} />
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col items-center gap-2 mt-auto pt-4 border-t border-white/20 sticky bottom-4">
          <Link href="/seleccionar-docente" className="w-10 h-10 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all">
            <ArrowLeftRight size={18} />
          </Link>
          <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 min-h-screen flex flex-col shrink-0 bg-[#C62828] transition-all duration-300">
      <div className="flex flex-col items-center px-5 py-5 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mc.png" alt="MCM" className="w-full max-w-[180px] h-auto" />
      </div>
      <button onClick={() => setExpanded(false)} className="self-start mx-4 mt-3 text-white/70 hover:text-white transition-colors">
        <X size={20} />
      </button>
      <nav className="flex-1 px-3 py-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/aula-virtual-docente" && pathname.startsWith(href + "/"));
          return (
            <Link key={href} href={href}
              className={clsx("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active ? "bg-white/20 text-white border-r-4 border-white" : "text-white/80 hover:bg-white/10 hover:text-white")}>
              <Icon size={18} className="shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pb-5 space-y-1 border-t border-white/10 pt-3 sticky bottom-0 bg-[#C62828]">
        <Link href="/seleccionar-docente" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all">
          <ArrowLeftRight size={18} /> <span>Cambiar módulo</span>
        </Link>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all">
          <LogOut size={18} /> <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
