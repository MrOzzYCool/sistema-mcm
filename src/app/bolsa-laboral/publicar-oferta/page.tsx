"use client";

import { useState } from "react";
import { validateOferta, OfertaFormData } from "@/lib/bolsa-laboral/validations";
import { ModalidadOferta } from "@/lib/bolsa-laboral/types";
import { AlertCircle, CheckCircle2, Briefcase, Send, RotateCcw } from "lucide-react";

const MODALIDAD_OPTIONS: { value: ModalidadOferta; label: string }[] = [
  { value: "presencial", label: "Presencial" },
  { value: "remoto", label: "Remoto" },
  { value: "hibrido", label: "Híbrido" },
];

export default function PublicarOfertaPage() {
  const [formData, setFormData] = useState<Partial<OfertaFormData>>({
    empresa_nombre: "",
    empresa_contacto: "",
    puesto: "",
    descripcion: "",
    requisitos: "",
    modalidad: undefined,
    ubicacion: "",
    fecha_cierre: "",
  });
  const [sueldoMin, setSueldoMin] = useState("");
  const [sueldoMax, setSueldoMax] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState("");

  function getTomorrowStr(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  function handleSueldoChange(field: "min" | "max", value: string) {
    if (field === "min") {
      setSueldoMin(value);
      if (errors.sueldo_min) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.sueldo_min;
          return next;
        });
      }
    } else {
      setSueldoMax(value);
      if (errors.sueldo_max) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.sueldo_max;
          return next;
        });
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError("");

    // Build data for validation
    const dataToValidate: Partial<OfertaFormData> = {
      ...formData,
      sueldo_min: sueldoMin ? Number(sueldoMin) : undefined,
      sueldo_max: sueldoMax ? Number(sueldoMax) : undefined,
    };

    const validationErrors = validateOferta(dataToValidate);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        empresa_nombre: formData.empresa_nombre?.trim(),
        empresa_contacto: formData.empresa_contacto?.trim(),
        puesto: formData.puesto?.trim(),
        descripcion: formData.descripcion?.trim(),
        modalidad: formData.modalidad,
      };

      if (formData.requisitos?.trim()) {
        body.requisitos = formData.requisitos.trim();
      }
      if (sueldoMin) {
        body.sueldo_min = Number(sueldoMin);
      }
      if (sueldoMax) {
        body.sueldo_max = Number(sueldoMax);
      }
      if (formData.ubicacion?.trim()) {
        body.ubicacion = formData.ubicacion.trim();
      }
      if (formData.fecha_cierre?.trim()) {
        body.fecha_cierre = formData.fecha_cierre.trim();
      }

      const res = await fetch("/api/bolsa-laboral/ofertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 201) {
        setSuccess(true);
      } else {
        const data = await res.json().catch(() => null);
        setApiError(data?.error || "Ocurrió un error al enviar la oferta. Intenta nuevamente.");
      }
    } catch {
      setApiError("Error de conexión. Verifica tu internet e intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "linear-gradient(160deg, #C62828 0%, #8E0000 100%)" }}
      >
        <div className="w-full max-w-lg">
          <div className="flex flex-col items-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-blanco.png"
              alt="I.E.S. Privada Margarita Cabrera"
              style={{ width: 240, height: "auto" }}
            />
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-mcm-text mb-2">
              ¡Oferta enviada exitosamente!
            </h2>
            <p className="text-mcm-muted text-sm mb-6">
              Su oferta laboral ha sido recibida y será revisada por nuestro equipo.
              Una vez aprobada, estará visible para nuestras egresadas.
            </p>
            <a
              href="/bolsa-laboral/publicar-oferta"
              className="inline-block btn-primary px-6 py-2.5 rounded-lg text-sm font-medium"
            >
              Publicar otra oferta
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen py-8 px-4"
      style={{ background: "linear-gradient(160deg, #C62828 0%, #8E0000 100%)" }}
    >
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-blanco.png"
            alt="I.E.S. Privada Margarita Cabrera"
            style={{ width: 240, height: "auto" }}
          />
          <p className="text-white/80 text-sm mt-3 tracking-wide">Bolsa Laboral</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-1">
            <Briefcase className="w-6 h-6 text-mcm-primary" />
            <h1 className="text-xl font-semibold text-mcm-text">Publicar oferta laboral</h1>
          </div>
          <p className="text-mcm-muted text-sm mb-6">
            Complete el formulario para enviar su oferta de empleo. Será revisada por nuestro equipo
            antes de ser publicada.
          </p>

          {/* API Error */}
          {apiError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-5 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span>{apiError}</span>
                <button
                  type="button"
                  onClick={handleSubmit as unknown as () => void}
                  className="ml-2 inline-flex items-center gap-1 text-red-800 underline hover:text-red-900 font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reintentar
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Empresa Nombre */}
            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1.5">
                Nombre de la empresa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="empresa_nombre"
                value={formData.empresa_nombre || ""}
                onChange={handleChange}
                placeholder="Ej: Consultora ABC S.A.C."
                disabled={loading}
                className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition disabled:opacity-60"
              />
              {errors.empresa_nombre && (
                <p className="text-red-600 text-xs mt-1">{errors.empresa_nombre}</p>
              )}
            </div>

            {/* Empresa Contacto */}
            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1.5">
                Email de contacto <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="empresa_contacto"
                value={formData.empresa_contacto || ""}
                onChange={handleChange}
                placeholder="contacto@empresa.com"
                disabled={loading}
                className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition disabled:opacity-60"
              />
              {errors.empresa_contacto && (
                <p className="text-red-600 text-xs mt-1">{errors.empresa_contacto}</p>
              )}
            </div>

            {/* Puesto */}
            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1.5">
                Puesto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="puesto"
                value={formData.puesto || ""}
                onChange={handleChange}
                placeholder="Ej: Asistente Administrativo"
                disabled={loading}
                className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition disabled:opacity-60"
              />
              {errors.puesto && (
                <p className="text-red-600 text-xs mt-1">{errors.puesto}</p>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1.5">
                Descripción del puesto <span className="text-red-500">*</span>
              </label>
              <textarea
                name="descripcion"
                value={formData.descripcion || ""}
                onChange={handleChange}
                placeholder="Describa las funciones principales, beneficios y detalles del puesto (mínimo 50 caracteres)"
                rows={4}
                disabled={loading}
                className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition disabled:opacity-60 resize-vertical"
              />
              <div className="flex justify-between mt-1">
                {errors.descripcion ? (
                  <p className="text-red-600 text-xs">{errors.descripcion}</p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-mcm-muted">
                  {(formData.descripcion || "").length}/50 mín.
                </span>
              </div>
            </div>

            {/* Requisitos */}
            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1.5">
                Requisitos
              </label>
              <textarea
                name="requisitos"
                value={formData.requisitos || ""}
                onChange={handleChange}
                placeholder="Requisitos del puesto (opcional)"
                rows={3}
                disabled={loading}
                className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition disabled:opacity-60 resize-vertical"
              />
            </div>

            {/* Sueldo Min / Max */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1.5">
                  Sueldo mínimo (S/)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={sueldoMin}
                  onChange={(e) => handleSueldoChange("min", e.target.value)}
                  placeholder="Ej: 1200"
                  disabled={loading}
                  className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition disabled:opacity-60"
                />
                {errors.sueldo_min && (
                  <p className="text-red-600 text-xs mt-1">{errors.sueldo_min}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1.5">
                  Sueldo máximo (S/)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={sueldoMax}
                  onChange={(e) => handleSueldoChange("max", e.target.value)}
                  placeholder="Ej: 2000"
                  disabled={loading}
                  className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition disabled:opacity-60"
                />
                {errors.sueldo_max && (
                  <p className="text-red-600 text-xs mt-1">{errors.sueldo_max}</p>
                )}
              </div>
            </div>

            {/* Modalidad */}
            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1.5">
                Modalidad <span className="text-red-500">*</span>
              </label>
              <select
                name="modalidad"
                value={formData.modalidad || ""}
                onChange={handleChange}
                disabled={loading}
                className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition disabled:opacity-60 bg-white"
              >
                <option value="">Seleccione una modalidad</option>
                {MODALIDAD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.modalidad && (
                <p className="text-red-600 text-xs mt-1">{errors.modalidad}</p>
              )}
            </div>

            {/* Ubicación */}
            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1.5">
                Ubicación
              </label>
              <input
                type="text"
                name="ubicacion"
                value={formData.ubicacion || ""}
                onChange={handleChange}
                placeholder="Ej: Lima, San Isidro"
                disabled={loading}
                className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition disabled:opacity-60"
              />
            </div>

            {/* Fecha de cierre */}
            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1.5">
                Fecha de cierre
              </label>
              <input
                type="date"
                name="fecha_cierre"
                value={formData.fecha_cierre || ""}
                onChange={handleChange}
                min={getTomorrowStr()}
                disabled={loading}
                className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary focus:border-transparent transition disabled:opacity-60"
              />
              {errors.fecha_cierre && (
                <p className="text-red-600 text-xs mt-1">{errors.fecha_cierre}</p>
              )}
              <p className="text-xs text-mcm-muted mt-1">
                Fecha límite para recibir postulaciones (opcional)
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                "Enviando..."
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar oferta para revisión
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          © 2026 I.E.S. Privada Margarita Cabrera
        </p>
      </div>
    </div>
  );
}
