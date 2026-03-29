"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { TramiteExterno, MOCK_TRAMITES_EXTERNOS, TramiteExternoEstado } from "./mock-data";

interface TramitesExternosCtx {
  tramites: TramiteExterno[];
  agregar: (t: TramiteExterno) => void;
  cambiarEstado: (id: string, estado: TramiteExternoEstado, observacion?: string) => void;
}

const Ctx = createContext<TramitesExternosCtx | null>(null);

export function TramitesExternosProvider({ children }: { children: ReactNode }) {
  const [tramites, setTramites] = useState<TramiteExterno[]>(MOCK_TRAMITES_EXTERNOS);

  function agregar(t: TramiteExterno) {
    setTramites((prev) => [t, ...prev]);
  }

  function cambiarEstado(id: string, estado: TramiteExternoEstado, observacion?: string) {
    setTramites((prev) =>
      prev.map((t) => (t.id === id ? { ...t, estado, observacion: observacion ?? t.observacion } : t))
    );
  }

  return <Ctx.Provider value={{ tramites, agregar, cambiarEstado }}>{children}</Ctx.Provider>;
}

export function useTramitesExternos() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTramitesExternos fuera de TramitesExternosProvider");
  return ctx;
}
