"use client";

import { useState } from "react";
import { getAccessToken } from "@/lib/get-token";
import { X, Loader2 } from "lucide-react";

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
    indicaciones: "",
    fecha_limite: "",
    hora_limite: "23:59",
    intentos_permitidos: 1,
    nota_maxima: 20,
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

      const res = await fetch("/api/portal/actividades", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          curso_id: cursoId,
          semana,
          titulo: form.titulo.trim(),
          tipo: form.tipo,
          indicaciones: form.indicaciones.trim() || null,
          fecha_limite: fechaLimite,
          intentos_permitidos: form.intentos_permitidos,
          nota_maxima: form.nota_maxima,
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
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
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

          {/* Indicaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Indicaciones de la tarea</label>
            <textarea
              value={form.indicaciones}
              onChange={e => setForm({ ...form, indicaciones: e.target.value })}
              placeholder="Escribe las instrucciones para los alumnos..."
              rows={6}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] resize-y"
            />
            <p className="text-xs text-gray-400 mt-1">Puedes usar formato: **negrita**, *cursiva*, - listas</p>
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
