"use client";

import { useState, useEffect, useCallback } from "react";
import { getAccessToken } from "@/lib/get-token";
import { X, Loader2 } from "lucide-react";
import { OfertaLaboral, ModalidadOferta } from "@/lib/bolsa-laboral/types";
import { validateOferta, OfertaFormData } from "@/lib/bolsa-laboral/validations";

interface OfertaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: OfertaLaboral | null;
}

const INITIAL_FORM: OfertaFormData = {
  empresa_nombre: "",
  empresa_contacto: "",
  puesto: "",
  descripcion: "",
  requisitos: "",
  sueldo_min: undefined,
  sueldo_max: undefined,
  modalidad: "presencial",
  ubicacion: "",
  fecha_cierre: "",
};

export default function OfertaFormModal({ isOpen, onClose, onSuccess, editData }: OfertaFormModalProps) {
  const [form, setForm] = useState<OfertaFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  const isEditMode = !!editData;

  // Pre-fill form when editing
  useEffect(() => {
    if (editData) {
      setForm({
        empresa_nombre: editData.empresa_nombre,
        empresa_contacto: editData.empresa_contacto,
        puesto: editData.puesto,
        descripcion: editData.descripcion,
        requisitos: editData.requisitos ?? "",
        sueldo_min: editData.sueldo_min ?? undefined,
        sueldo_max: editData.sueldo_max ?? undefined,
        modalidad: editData.modalidad,
        ubicacion: editData.ubicacion ?? "",
        fecha_cierre: editData.fecha_cierre ?? "",
      });
    } else {
      setForm(INITIAL_FORM);
    }
    setErrors({});
    setApiError("");
  }, [editData, isOpen]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleFieldChange(field: keyof OfertaFormData, value: string | number | undefined) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleSubmit() {
    // Client-side validation
    const validationErrors = validateOferta(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setApiError("");

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión activa");

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      if (isEditMode && editData) {
        // PATCH to update existing offer
        const res = await fetch("/api/bolsa-laboral/ofertas", {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            id: editData.id,
            empresa_nombre: form.empresa_nombre.trim(),
            empresa_contacto: form.empresa_contacto.trim(),
            puesto: form.puesto.trim(),
            descripcion: form.descripcion.trim(),
            requisitos: form.requisitos?.trim() || null,
            sueldo_min: form.sueldo_min ?? null,
            sueldo_max: form.sueldo_max ?? null,
            modalidad: form.modalidad,
            ubicacion: form.ubicacion?.trim() || null,
            fecha_cierre: form.fecha_cierre || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error al actualizar la oferta");
      } else {
        // CREATE: POST to create offer (pendiente), then PATCH to set activa
        const postRes = await fetch("/api/bolsa-laboral/ofertas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            empresa_nombre: form.empresa_nombre.trim(),
            empresa_contacto: form.empresa_contacto.trim(),
            puesto: form.puesto.trim(),
            descripcion: form.descripcion.trim(),
            requisitos: form.requisitos?.trim() || null,
            sueldo_min: form.sueldo_min ?? null,
            sueldo_max: form.sueldo_max ?? null,
            modalidad: form.modalidad,
            ubicacion: form.ubicacion?.trim() || null,
            fecha_cierre: form.fecha_cierre || null,
          }),
        });

        const postData = await postRes.json();
        if (!postRes.ok) throw new Error(postData.error ?? "Error al crear la oferta");

        // Immediately PATCH to set estado 'activa' (admin-created offers are directly active)
        const patchRes = await fetch("/api/bolsa-laboral/ofertas", {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            id: postData.id,
            estado: "activa",
            fecha_publicacion: new Date().toISOString(),
          }),
        });

        const patchData = await patchRes.json();
        if (!patchRes.ok) throw new Error(patchData.error ?? "Error al activar la oferta");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-lg">
            {isEditMode ? "Editar oferta" : "Crear oferta"}
          </h3>
          <button onClick={onClose} aria-label="Cerrar">
            <X size={20} className="text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* API Error */}
        {apiError && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded mb-3">{apiError}</p>
        )}

        <div className="space-y-4">
          {/* Empresa nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la empresa *
            </label>
            <input
              value={form.empresa_nombre}
              onChange={(e) => handleFieldChange("empresa_nombre", e.target.value)}
              placeholder="Ej: TechSoft Perú"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent"
            />
            {errors.empresa_nombre && (
              <p className="text-xs text-red-600 mt-1">{errors.empresa_nombre}</p>
            )}
          </div>

          {/* Empresa contacto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email de contacto *
            </label>
            <input
              type="email"
              value={form.empresa_contacto}
              onChange={(e) => handleFieldChange("empresa_contacto", e.target.value)}
              placeholder="contacto@empresa.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent"
            />
            {errors.empresa_contacto && (
              <p className="text-xs text-red-600 mt-1">{errors.empresa_contacto}</p>
            )}
          </div>

          {/* Puesto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Puesto *</label>
            <input
              value={form.puesto}
              onChange={(e) => handleFieldChange("puesto", e.target.value)}
              placeholder="Ej: Asistente Administrativo"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent"
            />
            {errors.puesto && <p className="text-xs text-red-600 mt-1">{errors.puesto}</p>}
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción del puesto *
            </label>
            <textarea
              value={form.descripcion}
              onChange={(e) => handleFieldChange("descripcion", e.target.value)}
              placeholder="Describe las responsabilidades y funciones del puesto (mínimo 50 caracteres)"
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent resize-y"
            />
            {errors.descripcion && (
              <p className="text-xs text-red-600 mt-1">{errors.descripcion}</p>
            )}
          </div>

          {/* Requisitos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requisitos</label>
            <textarea
              value={form.requisitos ?? ""}
              onChange={(e) => handleFieldChange("requisitos", e.target.value)}
              placeholder="Requisitos para el puesto (opcional)"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent resize-y"
            />
          </div>

          {/* Sueldo min/max */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sueldo mínimo (S/)
              </label>
              <input
                type="number"
                value={form.sueldo_min ?? ""}
                onChange={(e) =>
                  handleFieldChange(
                    "sueldo_min",
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                min={0}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent"
              />
              {errors.sueldo_min && (
                <p className="text-xs text-red-600 mt-1">{errors.sueldo_min}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sueldo máximo (S/)
              </label>
              <input
                type="number"
                value={form.sueldo_max ?? ""}
                onChange={(e) =>
                  handleFieldChange(
                    "sueldo_max",
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                min={0}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent"
              />
            </div>
          </div>

          {/* Modalidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad *</label>
            <select
              value={form.modalidad}
              onChange={(e) =>
                handleFieldChange("modalidad", e.target.value as ModalidadOferta)
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent"
            >
              <option value="presencial">Presencial</option>
              <option value="remoto">Remoto</option>
              <option value="hibrido">Híbrido</option>
            </select>
            {errors.modalidad && (
              <p className="text-xs text-red-600 mt-1">{errors.modalidad}</p>
            )}
          </div>

          {/* Ubicación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
            <input
              value={form.ubicacion ?? ""}
              onChange={(e) => handleFieldChange("ubicacion", e.target.value)}
              placeholder="Ej: Lima, San Isidro"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent"
            />
          </div>

          {/* Fecha de cierre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de cierre
            </label>
            <input
              type="date"
              value={form.fecha_cierre ?? ""}
              onChange={(e) => handleFieldChange("fecha_cierre", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent"
            />
            {errors.fecha_cierre && (
              <p className="text-xs text-red-600 mt-1">{errors.fecha_cierre}</p>
            )}
            <p className="text-[10px] text-gray-400 mt-0.5">
              Opcional. Fecha límite para recibir postulaciones.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-[#C62828] text-white rounded-lg text-sm font-medium hover:bg-[#A31F1F] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving
              ? isEditMode
                ? "Guardando..."
                : "Creando..."
              : isEditMode
              ? "Guardar cambios"
              : "Crear oferta"}
          </button>
        </div>
      </div>
    </div>
  );
}
