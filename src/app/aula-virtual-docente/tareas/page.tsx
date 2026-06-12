"use client";

import { ClipboardList } from "lucide-react";

export default function TareasDocentePage() {
  return (
    <div className="py-6 w-full">
      <h1 className="text-xl font-bold text-gray-800 mb-2">Tareas</h1>
      <p className="text-sm text-gray-500 mb-6">Revisa y califica las entregas de tus alumnos.</p>
      <div className="bg-white rounded-xl shadow-sm p-8 flex flex-col items-center justify-center min-h-[40vh]">
        <ClipboardList size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-500 text-center">Selecciona un curso desde "Mis Cursos" para ver sus tareas y entregas.</p>
      </div>
    </div>
  );
}
