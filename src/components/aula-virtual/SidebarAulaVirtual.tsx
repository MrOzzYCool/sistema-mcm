"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, MessageCircle, Calendar, HelpCircle, Settings,
  Menu, X, Mail, Library,
} from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/aula-virtual",            label: "Cursos",        icon: LayoutDashboard },
  { href: "/aula-virtual/chat",       label: "Chat",          icon: MessageCircle   },
  { href: "/aula-virtual/calendario", label: "Calendario",    icon: Calendar        },
  { href: "/aula-virtual/ayuda",      label: "Ayuda",         icon: HelpCircle      },
  { href: "/aula-virtual/config",     label: "Configuración", icon: Settings        },
];

const BOTTOM_ITEMS = [
  { href: "#", label: "Correo MC",     icon: Mail    },
  { href: "#", label: "Biblioteca MC", icon: Library },
];

export default function SidebarAulaVirtual() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  // Collapsed state
  if (!expanded) {
    return (
      <aside className="w-16 min-h-screen flex flex-col items-center shrink-0 py-4 bg-[#C62828] transition-all duration-300">
        {/* Logo icon */}
        <Link href="/aula-virtual" className="mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mc-icon.png" alt="MC" className="w-10 h-10 object-contain" />
        </Link>

        {/* Menu toggle */}
        <button onClick={() => setExpanded(true)} className="text-white/80 hover:text-white mb-6 transition-colors">
          <Menu size={22} />
        </button>

        {/* Nav icons */}
        <nav className="flex-1 flex flex-col items-center gap-2">
          {NAV_ITEMS.map(({ href, icon: Icon }) => {
            const active = pathname === href || (href !== "/aula-virtual" && pathname.startsWith(href + "/"));
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

        {/* Bottom sticky icons */}
        <div className="flex flex-col items-center gap-2 mt-auto pt-4 border-t border-white/20 sticky bottom-4">
          {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link key={label} href={href}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all">
              <Icon size={18} />
            </Link>
          ))}
        </div>
      </aside>
    );
  }

  // Expanded state
  return (
    <aside className="w-64 min-h-screen flex flex-col shrink-0 bg-[#C62828] transition-all duration-300">
      {/* Header: Logo */}
      <Link href="/aula-virtual" className="flex flex-col items-center px-5 py-5 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mc.png" alt="I.E.S. Privada Margarita Cabrera" className="w-full max-w-[180px] h-auto" />
      </Link>

      {/* Close button */}
      <button onClick={() => setExpanded(false)} className="self-start mx-4 mt-3 text-white/70 hover:text-white transition-colors">
        <X size={20} />
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/aula-virtual" && pathname.startsWith(href + "/"));
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

      {/* Bottom sticky actions */}
      <div className="px-3 pb-5 space-y-1 border-t border-white/10 pt-3 sticky bottom-0 bg-[#C62828]">
        {BOTTOM_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link key={label} href={href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all">
            <Icon size={18} /> <span>{label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
