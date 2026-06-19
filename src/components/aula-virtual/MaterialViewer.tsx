"use client";

import { useState, useEffect } from "react";
import {
  X, ChevronLeft, ChevronRight, Download, FileText,
  FileSpreadsheet, Image as ImageIcon, Video as VideoIcon, Loader2,
} from "lucide-react";

interface MaterialItem {
  id: string;
  nombre_archivo: string;
  tipo_archivo: string;
  tamano: number;
  seccion: string;
}

interface MaterialViewerProps {
  /** Material actualmente seleccionado */
  material: MaterialItem;
  /** URL firmada del material actual */
  presignedUrl: string | null;
  /** Lista de todos los materiales de la misma sección/semana para navegación */
  allMaterials: MaterialItem[];
  /** Índice actual en la lista */
  currentIndex: number;
  /** Callback para cerrar el visor */
  onClose: () => void;
  /** Callback para navegar a otro material (recibe el id) */
  onNavigate: (materialId: string) => void;
  /** Loading state */
  loading?: boolean;
}

function getTypeLabel(tipo: string): string {
  const map: Record<string, string> = {
    pdf: "PDF",
    docx: "Word",
    xlsx: "Excel",
    pptx: "PowerPoint",
    jpg: "Imagen",
    jpeg: "Imagen",
    png: "Imagen",
    mp4: "Video",
  };
  return map[tipo] ?? tipo.toUpperCase();
}

function getTypeIcon(tipo: string) {
  switch (tipo) {
    case "pdf": return <FileText size={16} className="text-red-600" />;
    case "mp4": return <VideoIcon size={16} className="text-blue-600" />;
    case "docx": return <FileText size={16} className="text-blue-500" />;
    case "xlsx": return <FileSpreadsheet size={16} className="text-green-600" />;
    case "pptx": return <FileText size={16} className="text-orange-500" />;
    case "jpg": case "jpeg": case "png": return <ImageIcon size={16} className="text-purple-500" />;
    default: return <FileText size={16} className="text-gray-500" />;
  }
}

function getSectionLabel(seccion: string): string {
  const map: Record<string, string> = {
    material: "Material",
    actividad: "Actividad",
    foro: "Foro",
  };
  return map[seccion] ?? "Material";
}

export default function MaterialViewer({
  material,
  presignedUrl,
  allMaterials,
  currentIndex,
  onClose,
  onNavigate,
  loading = false,
}: MaterialViewerProps) {
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < allMaterials.length - 1;

  const handlePrev = () => {
    if (canGoPrev) onNavigate(allMaterials[currentIndex - 1].id);
  };

  const handleNext = () => {
    if (canGoNext) onNavigate(allMaterials[currentIndex + 1].id);
  };

  const handleDownload = () => {
    if (presignedUrl) {
      const a = document.createElement("a");
      a.href = presignedUrl;
      a.download = material.nombre_archivo;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, allMaterials]);

  const isPreviewable = ["pdf", "jpg", "jpeg", "png", "mp4"].includes(material.tipo_archivo);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-800 truncate">{material.nombre_archivo}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">{getSectionLabel(material.seccion)}</span>
              <span className="text-xs text-gray-300">&bull;</span>
              <div className="flex items-center gap-1">
                {getTypeIcon(material.tipo_archivo)}
                <span className="text-xs text-gray-500">{getTypeLabel(material.tipo_archivo)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Cerrar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content / Preview */}
        <div className="flex-1 overflow-auto bg-gray-100 relative min-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={32} className="animate-spin text-gray-400" />
            </div>
          ) : presignedUrl ? (
            <>
              {material.tipo_archivo === "pdf" && (
                <iframe
                  src={presignedUrl}
                  className="w-full h-full min-h-[500px]"
                  title={material.nombre_archivo}
                  style={{ border: "none" }}
                />
              )}
              {["jpg", "jpeg", "png"].includes(material.tipo_archivo) && (
                <div className="flex items-center justify-center h-full p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={presignedUrl}
                    alt={material.nombre_archivo}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
                  />
                </div>
              )}
              {material.tipo_archivo === "mp4" && (
                <div className="flex items-center justify-center h-full p-4">
                  <video
                    src={presignedUrl}
                    controls
                    className="max-w-full max-h-[60vh] rounded-lg shadow-sm"
                  >
                    Tu navegador no soporta la reproducción de video.
                  </video>
                </div>
              )}
              {!isPreviewable && (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                  <div className="w-20 h-20 bg-white rounded-xl shadow-sm flex items-center justify-center">
                    {getTypeIcon(material.tipo_archivo)}
                  </div>
                  <p className="text-sm text-gray-500">
                    Vista previa no disponible para archivos {getTypeLabel(material.tipo_archivo)}.
                  </p>
                  <p className="text-xs text-gray-400">Descarga el archivo para verlo.</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">Error al cargar el archivo.</p>
            </div>
          )}
        </div>

        {/* Footer - Download + Navigation */}
        <div className="border-t border-gray-200">
          {/* Download bar */}
          <div className="flex items-center justify-between px-6 py-3 bg-gray-50">
            <p className="text-sm text-gray-500">Recuerda que puedes descargar el archivo.</p>
            <button
              onClick={handleDownload}
              disabled={!presignedUrl}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[#C62828] text-[#C62828] rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              Descargar archivo
            </button>
          </div>

          {/* Navigation */}
          {allMaterials.length > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
              <button
                onClick={handlePrev}
                disabled={!canGoPrev}
                className="inline-flex items-center gap-1 text-sm text-[#C62828] hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
              <span className="text-xs text-gray-400">
                {currentIndex + 1} de {allMaterials.length}
              </span>
              <button
                onClick={handleNext}
                disabled={!canGoNext}
                className="inline-flex items-center gap-1 text-sm text-[#C62828] hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
              >
                Siguiente
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
