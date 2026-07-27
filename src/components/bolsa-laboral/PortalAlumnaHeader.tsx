"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Menu, X, LogOut } from "lucide-react";
import { useState } from "react";

export default function PortalAlumnaHeader() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/bolsa-laboral", label: "Ofertas" },
    { href: "/bolsa-laboral/mis-postulaciones", label: "Mis Postulaciones" },
  ];

  function isActive(href: string) {
    if (href === "/bolsa-laboral") {
      return pathname === "/bolsa-laboral" || pathname.startsWith("/bolsa-laboral/oferta");
    }
    return pathname.startsWith(href);
  }

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Desktop Nav */}
          <div className="flex items-center gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-mc.png"
              alt="Instituto Margarita Cabrera"
              className="h-9 w-auto"
            />

            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? "bg-[#D32F2F]/10 text-[#C62828]"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Desktop: User info + Logout */}
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm text-gray-700 font-medium">
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-md transition-colors"
              style={{ backgroundColor: "#D32F2F" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#C62828")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#D32F2F")}
            >
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>

          {/* Mobile: Hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            {/* User name */}
            <div className="px-3 py-2 text-sm font-medium text-gray-700 border-b border-gray-100 mb-2">
              {user?.name}
            </div>

            {/* Nav links */}
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-[#D32F2F]/10 text-[#C62828]"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Logout */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 mt-2 rounded-md text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: "#D32F2F" }}
            >
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
