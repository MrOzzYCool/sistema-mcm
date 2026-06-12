"use client";

import { BookOpen } from "lucide-react";

export default function NotasDocentePage() {
  return (
    <div className="py-6 w-full">
      <h1 className="text-xl font-bold text-gray-800 mb-2">Libro de Notas</h1>
      <p className="text-sm text-gray-500 mb-6">Gestiona las calificaciones de tus alumnos.</p>
      <div className="bg-white rounded-xl shadow-sm p-8 flex flex-col items-center justify-center min-h-[40vh]">
        <BookOpen size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-500 text-center">Selecciona un curso desde &ldquo;Mis Cursos&rdquo; para acceder a su libro de notas.</p>
      </div>
    </div>
  );
}
