"use client";

import { Settings } from "lucide-react";

export default function ConfigDocentePage() {
  return (
    <div className="py-6 w-full">
      <h1 className="text-xl font-bold text-gray-800 mb-2">Configuración</h1>
      <p className="text-sm text-gray-500 mb-6">Ajustes de tu perfil y preferencias.</p>
      <div className="bg-white rounded-xl shadow-sm p-8 flex flex-col items-center justify-center min-h-[40vh]">
        <Settings size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-500 text-center">Configuración del docente disponible próximamente.</p>
      </div>
    </div>
  );
}
