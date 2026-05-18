"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

interface GerenciaLayoutProps {
  children: React.ReactNode;
}

const TABS = [
  { label: "Dashboard", href: "/dashboard/gerencia" },
  { label: "Finanzas", href: "/dashboard/gerencia/finanzas" },
  { label: "Trámites", href: "/dashboard/gerencia/tramites" },
];

export default function GerenciaLayout({ children }: GerenciaLayoutProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard/gerencia") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="w-full px-6 lg:px-10 xl:px-16 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-mcm-text">Gerencia</h1>
        <p className="text-mcm-muted text-sm mt-0.5">Dashboard ejecutivo</p>
      </div>

      {/* Tab navigation */}
      <nav className="flex gap-1 border-b border-mcm-border">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors",
              isActive(tab.href)
                ? "text-mcm-primary border-b-2 border-mcm-primary bg-red-50/50"
                : "text-mcm-muted hover:text-mcm-text hover:bg-slate-50"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* Content */}
      {children}
    </div>
  );
}
