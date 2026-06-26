"use client";

import { useState } from "react";
import { getAccessToken } from "@/lib/get-token";
import { X, Loader2, Eye, EyeOff } from "lucide-react";

const INDICACIONES_PREDETERMINADAS = `Lee los anuncios, en ellos tu docente comparte información importante sobre el desarrollo de la tarea.

1. Logro de aprendizaje
A través de esta actividad, el estudiante demuestra los conocimientos adquiridos durante la semana, aplicando la teoría en ejercicios prácticos.

2. Descripción
- Paso 1: Revisa el material de estudio de la semana y tus apuntes de sesión.
- Paso 2: Desarrolla la actividad siguiendo las indicaciones del docente.
- Paso 3: Sube tu trabajo en el formato solicitado antes de la fecha límite.

3. Materiales a utilizar
- Material de estudio de la semana
- Apuntes personales de clase
- Material adicional proporcionado por el docente

4. Formato de entrega
- Archivo en formato PDF, Word, Excel o PowerPoint
- Incluir nombres completos y apellidos en la portada
- Nombrar el archivo: Tarea_Semana[N]_[Apellidos]

⚠️ Todo acto de copiar, intentar copiar o dejar copiar, durante una prueba, examen, práctica, trabajo o cualquier asignación académica - usando tanto el medio físico como el electrónico - se encuentra normado en el Reglamento de Estudios y el Reglamento de Disciplina del Estudiante vigentes en el Portal de Transparencia y/o en el Portal del Estudiante.`;

interface CrearActividadModalProps {
  cursoId: string;
  semana: number;
  onClose: () => void;
  onCreated: () => void;
}

export default function CrearActividadModal({ cursoId, semana, onClose, onCreated }: CrearActividadModalProps) {
  const [form, setForm] = useState({
    titulo: "",
    tipo: "tarea",
    indicaciones: INDICACIONES_PREDETERMINADAS,
    fecha_inicio: "",
    hora_inicio: "00:00",
    fecha_limite: "",
    hora_limite: "23:59",
    intentos_permitidos: 1,
    nota_maxima: 20,
    visible: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!form.titulo.trim() || !form.fecha_limite) {
      setError("Título y fecha límite son obligatorios");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión");

      const fechaLimite = `${form.fecha_limite}T${form.hora_limite}:00`;
      const fechaInicio = form.fecha_inicio ? `${form.fecha_inicio}T${form.hora_inicio}:00` : null;

      const res = await fetch("/api/portal/actividades", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          curso_id: cursoId,
          semana,
          titulo: form.titulo.trim(),
          tipo: form.tipo,
          indicaciones: form.indicaciones.trim() || null,
          fecha_inicio: fechaInicio,
          fecha_limite: fechaLimite,
          intentos_permitidos: form.intentos_permitidos,
          nota_maxima: form.nota_maxima,
          visible: form.visible,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error creando actividad");

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-lg">Crear Actividad — Semana {semana}</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded mb-3">{error}</p>}

        <div className="space-y-4">
          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título de la actividad *</label>
            <input
              value={form.titulo}
              onChange={e => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ej: Tarea Semana 14 - Planes de vacaciones"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={form.tipo}
              onChange={e => setForm({ ...form, tipo: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828]"
            >
              <option value="tarea">Tarea</option>
              <option value="practica">Práctica calificada</option>
              <option value="examen">Examen</option>
              <option value="participacion">Participación en clase</option>
            </select>
          </div>

          {/* Fecha de inicio (habilitación) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de inicio (habilitación)</label>
              <input
                type="date"
                value={form.fecha_inicio}
                onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828]"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Opcional. Si no se indica, se habilita inmediatamente.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora de inicio</label>
              <input
                type="time"
                value={form.hora_inicio}
                onChange={e => setForm({ ...form, hora_inicio: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828]"
              />
            </div>
          </div>

          {/* Fecha y hora límite */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha límite *</label>
              <input
                type="date"
                value={form.fecha_limite}
                onChange={e => setForm({ ...form, fecha_limite: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora límite</label>
              <input
                type="time"
                value={form.hora_limite}
                onChange={e => setForm({ ...form, hora_limite: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828]"
              />
            </div>
          </div>

          {/* Intentos y nota */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Intentos permitidos</label>
              <select
                value={form.intentos_permitidos}
                onChange={e => setForm({ ...form, intentos_permitidos: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828]"
              >
                <option value={1}>1 intento</option>
                <option value={2}>2 intentos</option>
                <option value={3}>3 intentos</option>
                <option value={99}>Ilimitado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nota máxima</label>
              <input
                type="number"
                value={form.nota_maxima}
                onChange={e => setForm({ ...form, nota_maxima: Number(e.target.value) })}
                min={1} max={100}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828]"
              />
            </div>
          </div>

          {/* Visibilidad */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700">Visibilidad para alumnos</p>
              <p className="text-xs text-gray-400">{form.visible ? "Los alumnos pueden ver esta actividad" : "Oculta — solo tú puedes verla"}</p>
            </div>
            <button onClick={() => setForm({ ...form, visible: !form.visible })}
              className={`p-2 rounded-lg transition-colors ${form.visible ? "text-green-600 bg-green-100" : "text-orange-500 bg-orange-100"}`}>
              {form.visible ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>

          {/* Indicaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Indicaciones de la tarea</label>
            <textarea
              value={form.indicaciones}
              onChange={e => setForm({ ...form, indicaciones: e.target.value })}
              rows={10}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] resize-y font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">Las indicaciones vienen predeterminadas. Edítalas según tu necesidad.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.titulo.trim() || !form.fecha_limite}
            className="flex-1 px-4 py-2 bg-[#C62828] text-white rounded-lg text-sm font-medium hover:bg-[#A31F1F] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Creando..." : "Crear actividad"}
          </button>
        </div>
      </div>
    </div>
  );
}
