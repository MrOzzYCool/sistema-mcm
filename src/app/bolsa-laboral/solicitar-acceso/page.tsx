"use client";

import { useState } from "react";
import Link from "next/link";
import { validateSolicitud, SolicitudFormData } from "@/lib/bolsa-laboral/validations";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";

const CARRERAS = [
  "Asistencia Administrativa",
  "Recursos Humanos",
  "Contabilidad",
  "Administración de Negocios Internacionales",
  "Marketing Empresarial",
];

export default function SolicitarAccesoPage() {
  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState<Partial<SolicitudFormData>>({
    alumna_nombre: "",
    alumna_dni: "",
    alumna_email: "",
    alumna_telefono: "",
    carrera: "",
    anio_ingreso: undefined,
    anio_egreso: undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "anio_ingreso" || name === "anio_egreso"
          ? value === ""
            ? undefined
            : Number(value)
          : value,
    }));
    // Clear field error on change
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (apiError) setApiError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError("");

    // Client-side validation
    const validationErrors = validateSolicitud(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      const res = await fetch("/api/bolsa-laboral/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.status === 201) {
        setSuccess(true);
        return;
      }

      if (res.status === 409) {
        setApiError("Ya existe una solicitud para este DNI");
        return;
      }

      const data = await res.json().catch(() => null);
      setApiError(
        data?.error || "Ocurrió un error al enviar la solicitud. Intenta nuevamente."
      );
    } catch {
      setApiError("Error de conexión. Verifica tu conexión e intenta nuevamente.");
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
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-blanco.png"
              alt="I.E.S. Privada Margarita Cabrera"
              style={{ width: 300, height: "auto" }}
            />
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              ¡Solicitud enviada!
            </h2>
            <p className="text-gray-600 text-sm">
              Tu solicitud ha sido enviada y será revisada por la administración.
              Te notificaremos por email una vez sea procesada.
            </p>
            <Link
              href="/"
              className="inline-block mt-6 px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: "#C62828" }}
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
            style={{ width: 300, height: "auto" }}
          />
          <p className="text-white/80 text-sm mt-3 tracking-wide">
            Bolsa Laboral — Solicitar Acceso
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-1">
            Solicitar acceso
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Completa el formulario para solicitar acceso a la bolsa laboral del instituto.
          </p>

          {apiError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-5 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nombre completo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="alumna_nombre"
                value={formData.alumna_nombre || ""}
                onChange={handleChange}
                placeholder="Ingresa tu nombre completo"
                disabled={loading}
                className={`w-full border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition disabled:opacity-60 ${
                  errors.alumna_nombre ? "border-red-400" : "border-gray-300"
                }`}
              />
              {errors.alumna_nombre && (
                <p className="text-red-500 text-xs mt-1">{errors.alumna_nombre}</p>
              )}
            </div>

            {/* DNI */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                DNI <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="alumna_dni"
                value={formData.alumna_dni || ""}
                onChange={handleChange}
                placeholder="12345678"
                maxLength={8}
                disabled={loading}
                className={`w-full border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition disabled:opacity-60 ${
                  errors.alumna_dni ? "border-red-400" : "border-gray-300"
                }`}
              />
              {errors.alumna_dni && (
                <p className="text-red-500 text-xs mt-1">{errors.alumna_dni}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="alumna_email"
                value={formData.alumna_email || ""}
                onChange={handleChange}
                placeholder="tu@email.com"
                disabled={loading}
                className={`w-full border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition disabled:opacity-60 ${
                  errors.alumna_email ? "border-red-400" : "border-gray-300"
                }`}
              />
              {errors.alumna_email && (
                <p className="text-red-500 text-xs mt-1">{errors.alumna_email}</p>
              )}
            </div>

            {/* Teléfono (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Teléfono <span className="text-gray-400 text-xs">(opcional)</span>
              </label>
              <input
                type="text"
                name="alumna_telefono"
                value={formData.alumna_telefono || ""}
                onChange={handleChange}
                placeholder="999 999 999"
                disabled={loading}
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition disabled:opacity-60"
              />
            </div>

            {/* Carrera */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Carrera <span className="text-red-500">*</span>
              </label>
              <select
                name="carrera"
                value={formData.carrera || ""}
                onChange={handleChange}
                disabled={loading}
                className={`w-full border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition disabled:opacity-60 ${
                  errors.carrera ? "border-red-400" : "border-gray-300"
                }`}
              >
                <option value="">Selecciona tu carrera</option>
                {CARRERAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.carrera && (
                <p className="text-red-500 text-xs mt-1">{errors.carrera}</p>
              )}
            </div>

            {/* Año ingreso y egreso */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Año de ingreso <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="anio_ingreso"
                  value={formData.anio_ingreso ?? ""}
                  onChange={handleChange}
                  placeholder="2020"
                  min={2000}
                  max={currentYear}
                  disabled={loading}
                  className={`w-full border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition disabled:opacity-60 ${
                    errors.anio_ingreso ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {errors.anio_ingreso && (
                  <p className="text-red-500 text-xs mt-1">{errors.anio_ingreso}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Año de egreso <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="anio_egreso"
                  value={formData.anio_egreso ?? ""}
                  onChange={handleChange}
                  placeholder="2023"
                  min={2000}
                  max={currentYear + 1}
                  disabled={loading}
                  className={`w-full border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition disabled:opacity-60 ${
                    errors.anio_egreso ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {errors.anio_egreso && (
                  <p className="text-red-500 text-xs mt-1">{errors.anio_egreso}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: "#C62828" }}
            >
              {loading ? (
                "Enviando..."
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar solicitud
                </>
              )}
            </button>
          </form>

          <p className="text-center text-gray-400 text-xs mt-6">
            Tu solicitud será revisada por la administración del instituto.
          </p>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          © {currentYear} I.E.S. Privada Margarita Cabrera
        </p>
      </div>
    </div>
  );
}
