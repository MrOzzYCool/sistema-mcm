"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getAccessToken } from "@/lib/get-token";
import type { OfertaLaboral, Postulacion, EstadoPostulacion } from "@/lib/bolsa-laboral/types";
import { ArrowLeft, MapPin, Briefcase, Calendar, DollarSign, Clock } from "lucide-react";
import PostulacionForm from "@/components/bolsa-laboral/PostulacionForm";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatModalidad(modalidad: string): string {
  const labels: Record<string, string> = {
    presencial: "Presencial",
    remoto: "Remoto",
    hibrido: "Híbrido",
  };
  return labels[modalidad] || modalidad;
}

function isOfferExpired(fechaCierre: string | null): boolean {
  if (!fechaCierre) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cierre = new Date(fechaCierre);
  cierre.setHours(0, 0, 0, 0);
  return cierre < today;
}

function getBadgeStyles(estado: EstadoPostulacion): { bg: string; text: string } {
  switch (estado) {
    case "enviada":
      return { bg: "bg-blue-100", text: "text-blue-800" };
    case "vista":
      return { bg: "bg-yellow-100", text: "text-yellow-800" };
    case "seleccionada":
      return { bg: "bg-green-100", text: "text-green-800" };
    case "descartada":
      return { bg: "bg-red-100", text: "text-red-800" };
    default:
      return { bg: "bg-gray-100", text: "text-gray-800" };
  }
}

function getEstadoLabel(estado: EstadoPostulacion): string {
  const labels: Record<string, string> = {
    enviada: "Enviada",
    vista: "Vista",
    seleccionada: "Seleccionada",
    descartada: "Descartada",
  };
  return labels[estado] || estado;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OfertaDetallePage() {
  const params = useParams();
  const id = params.id as string;

  const [oferta, setOferta] = useState<OfertaLaboral | null>(null);
  const [postulacion, setPostulacion] = useState<Postulacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPostulacionForm, setShowPostulacionForm] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const token = await getAccessToken();
        if (!token) {
          setError("No se pudo obtener el token de autenticación.");
          return;
        }

        // Fetch active offers and find by ID
        const ofertasRes = await fetch("/api/bolsa-laboral/ofertas/activas", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!ofertasRes.ok) {
          setError("Error al cargar la oferta.");
          return;
        }

        const ofertas: OfertaLaboral[] = await ofertasRes.json();
        const found = ofertas.find((o) => o.id === id);

        if (!found) {
          setError("Oferta no encontrada.");
          return;
        }

        setOferta(found);

        // Check if alumna already applied
        const postRes = await fetch("/api/bolsa-laboral/postulaciones", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (postRes.ok) {
          const postulaciones: Postulacion[] = await postRes.json();
          const existing = postulaciones.find((p) => p.oferta_id === id);
          if (existing) {
            setPostulacion(existing);
          }
        }
      } catch {
        setError("Error de conexión. Intenta nuevamente.");
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchData();
  }, [id]);

  // ─── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D32F2F] mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Cargando oferta...</p>
        </div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────────────

  if (error || !oferta) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <Link
          href="/bolsa-laboral"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={16} />
          Volver a ofertas
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700">{error || "Oferta no encontrada."}</p>
        </div>
      </div>
    );
  }

  // ─── Derived state ───────────────────────────────────────────────────────────

  const expired = isOfferExpired(oferta.fecha_cierre);
  const alreadyApplied = !!postulacion;
  const canPostulate = !alreadyApplied && !expired;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto py-6">
      {/* Back link */}
      <Link
        href="/bolsa-laboral"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={16} />
        Volver a ofertas
      </Link>

      {/* Offer detail card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900">{oferta.puesto}</h1>
          <p className="text-lg text-gray-600 mt-1">{oferta.empresa_nombre}</p>
        </div>

        {/* Info grid */}
        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-gray-100">
          {/* Modalidad */}
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Briefcase size={16} className="text-gray-400" />
            <span className="font-medium">Modalidad:</span>
            <span>{formatModalidad(oferta.modalidad)}</span>
          </div>

          {/* Ubicación */}
          {oferta.ubicacion && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <MapPin size={16} className="text-gray-400" />
              <span className="font-medium">Ubicación:</span>
              <span>{oferta.ubicacion}</span>
            </div>
          )}

          {/* Salario */}
          {(oferta.sueldo_min || oferta.sueldo_max) && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <DollarSign size={16} className="text-gray-400" />
              <span className="font-medium">Salario:</span>
              <span>
                {oferta.sueldo_min && oferta.sueldo_max
                  ? `${formatCurrency(oferta.sueldo_min)} - ${formatCurrency(oferta.sueldo_max)}`
                  : oferta.sueldo_min
                  ? `Desde ${formatCurrency(oferta.sueldo_min)}`
                  : `Hasta ${formatCurrency(oferta.sueldo_max!)}`}
              </span>
            </div>
          )}

          {/* Fecha publicación */}
          {oferta.fecha_publicacion && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Calendar size={16} className="text-gray-400" />
              <span className="font-medium">Publicada:</span>
              <span>{formatDate(oferta.fecha_publicacion)}</span>
            </div>
          )}

          {/* Fecha cierre */}
          {oferta.fecha_cierre && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Clock size={16} className={expired ? "text-red-400" : "text-gray-400"} />
              <span className="font-medium">Cierre:</span>
              <span className={expired ? "text-red-600 font-medium" : ""}>
                {formatDate(oferta.fecha_cierre)}
                {expired && " (Expirada)"}
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
            Descripción
          </h2>
          <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
            {oferta.descripcion}
          </p>
        </div>

        {/* Requisitos */}
        {oferta.requisitos && (
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
              Requisitos
            </h2>
            <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
              {oferta.requisitos}
            </p>
          </div>
        )}

        {/* Postulation section */}
        <div className="px-6 py-5">
          {/* Already applied: show status */}
          {alreadyApplied && postulacion && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2">Ya te postulaste a esta oferta.</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Estado:</span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeStyles(postulacion.estado).bg} ${getBadgeStyles(postulacion.estado).text}`}
                >
                  {getEstadoLabel(postulacion.estado)}
                </span>
              </div>
              {postulacion.created_at && (
                <p className="text-xs text-gray-500 mt-1">
                  Postulación enviada el {formatDate(postulacion.created_at)}
                </p>
              )}
            </div>
          )}

          {/* Expired: show message */}
          {!alreadyApplied && expired && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700 font-medium">
                El período de postulación ha finalizado.
              </p>
              <p className="text-xs text-red-600 mt-1">
                La fecha de cierre para esta oferta fue el {formatDate(oferta.fecha_cierre!)}.
              </p>
            </div>
          )}

          {/* Can postulate: show button */}
          {canPostulate && !showPostulacionForm && (
            <button
              onClick={() => setShowPostulacionForm(true)}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium text-white rounded-lg transition-colors"
              style={{ backgroundColor: "#D32F2F" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#C62828")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#D32F2F")}
            >
              Postular
            </button>
          )}

          {/* Postulacion form */}
          {canPostulate && showPostulacionForm && (
            <div className="border border-gray-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Postular a esta oferta</h3>
                <button
                  onClick={() => setShowPostulacionForm(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
              </div>
              <PostulacionForm
                ofertaId={id}
                onSuccess={() => {
                  setShowPostulacionForm(false);
                  setPostulacion({
                    id: "",
                    oferta_id: id,
                    alumna_id: "",
                    mensaje: null,
                    cv_url: null,
                    estado: "enviada",
                    created_at: new Date().toISOString(),
                  });
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
