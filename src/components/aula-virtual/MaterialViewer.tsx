"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft, ChevronRight, Download, FileText,
  FileSpreadsheet, Image as ImageIcon, Video as VideoIcon, Loader2,
  ArrowLeft, ZoomIn, ZoomOut, Hand, Search, Settings, Maximize,
  Printer, PanelLeft, X,
} from "lucide-react";

// Set PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface MaterialItem {
  id: string;
  nombre_archivo: string;
  tipo_archivo: string;
  tamano: number;
  seccion: string;
}

interface MaterialViewerProps {
  material: MaterialItem;
  presignedUrl: string | null;
  allMaterials: MaterialItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (materialId: string) => void;
  loading?: boolean;
  // Week-level navigation (Anterior/Siguiente across foro/material/actividad)
  totalWeekItems?: number;
  weekItemIndex?: number;
  onPrev?: () => void;
  onNext?: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
}

function getTypeLabel(tipo: string): string {
  const map: Record<string, string> = { pdf: "PDF", docx: "Word", xlsx: "Excel", pptx: "PowerPoint", jpg: "Imagen", jpeg: "Imagen", png: "Imagen", mp4: "Video" };
  return map[tipo] ?? tipo.toUpperCase();
}

function getSectionLabel(seccion: string): string {
  return ({ material: "Material", actividad: "Actividad", foro: "Foro" })[seccion] ?? "Material";
}

export default function MaterialViewer({
  material, presignedUrl, allMaterials, currentIndex, onClose, onNavigate, loading = false,
  totalWeekItems, weekItemIndex, onPrev, onNext, canGoPrev, canGoNext,
}: MaterialViewerProps) {
  // Use week-level nav if provided, otherwise fallback to material-only nav
  const usesWeekNav = onPrev !== undefined && onNext !== undefined;
  const navPrev = usesWeekNav ? onPrev! : () => { if (currentIndex > 0) onNavigate(allMaterials[currentIndex - 1].id); };
  const navNext = usesWeekNav ? onNext! : () => { if (currentIndex < allMaterials.length - 1) onNavigate(allMaterials[currentIndex + 1].id); };
  const prevDisabled = usesWeekNav ? !canGoPrev : currentIndex <= 0;
  const nextDisabled = usesWeekNav ? !canGoNext : currentIndex >= allMaterials.length - 1;

  const handleDownload = () => {
    if (presignedUrl) { const a = document.createElement("a"); a.href = presignedUrl; a.download = material.nombre_archivo; a.target = "_blank"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && e.altKey) navPrev();
      if (e.key === "ArrowRight" && e.altKey) navNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navPrev, navNext, onClose]);

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto flex-1 min-h-0">
      {/* Title area */}
      <div className="py-2 shrink-0">
        <h1 className="text-lg font-bold text-gray-800">{material.nombre_archivo}</h1>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">{getSectionLabel(material.seccion)}</span>
          <span className="text-xs text-gray-300">&bull;</span>
          <span className="text-xs text-gray-500">{getTypeLabel(material.tipo_archivo)}</span>
        </div>
      </div>

      {/* PDF Viewer / Content */}
      <div className="flex-1 min-h-0 overflow-hidden bg-gray-100">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
        ) : presignedUrl ? (
          <>
            {material.tipo_archivo === "pdf" && <PdfViewer url={presignedUrl} />}
            {["jpg", "jpeg", "png"].includes(material.tipo_archivo) && (
              <div className="flex items-center justify-center h-full p-6 overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={presignedUrl} alt={material.nombre_archivo} className="max-w-full max-h-full object-contain rounded shadow-sm" />
              </div>
            )}
            {material.tipo_archivo === "mp4" && (
              <div className="flex items-center justify-center h-full p-6">
                <video src={presignedUrl} controls className="max-w-full max-h-full rounded shadow-sm">Tu navegador no soporta video.</video>
              </div>
            )}
            {!["pdf", "jpg", "jpeg", "png", "mp4"].includes(material.tipo_archivo) && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <FileText size={48} className="text-gray-300" />
                <p className="text-sm text-gray-500">Vista previa no disponible. Descarga el archivo.</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full"><p className="text-sm text-gray-400">Error al cargar archivo.</p></div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white shrink-0 mt-2">
        <div className="flex items-center justify-between py-2">
          <p className="text-xs text-gray-500">Recuerda que puedes descargar el archivo.</p>
          <button onClick={handleDownload} disabled={!presignedUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#C62828] text-[#C62828] rounded text-xs font-medium hover:bg-red-50 disabled:opacity-40">
            <Download size={14} /> Descargar archivo
          </button>
        </div>
        <div className="flex items-center justify-between py-2.5 border-t border-gray-100">
          <button onClick={navPrev} disabled={prevDisabled}
            className="inline-flex items-center gap-1 text-sm text-[#C62828] hover:underline disabled:text-gray-300 disabled:cursor-not-allowed">
            <ChevronLeft size={16} /> Anterior
          </button>
          <button onClick={navNext} disabled={nextDisabled}
            className="inline-flex items-center gap-1 text-sm text-[#C62828] hover:underline disabled:text-gray-300 disabled:cursor-not-allowed">
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PDF Viewer with toolbar, thumbnails, zoom, search ─────────────────────

function PdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.8);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [dragMode, setDragMode] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n);
  }

  const zoomIn = () => setScale(s => Math.min(s + 0.1, 2.5));
  const zoomOut = () => setScale(s => Math.max(s - 0.1, 0.3));
  const zoomPercent = Math.round(scale * 100);

  const goFullscreen = () => {
    if (mainRef.current) mainRef.current.requestFullscreen?.();
  };

  const handlePrint = () => {
    const w = window.open(url, "_blank");
    if (w) { w.addEventListener("load", () => { w.print(); }); }
  };

  return (
    <div className="flex flex-col h-full" ref={mainRef}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-t-lg shrink-0 overflow-x-auto">
        {/* Toggle sidebar */}
        <button onClick={() => setShowSidebar(!showSidebar)} title="Panel de páginas"
          className={`p-1.5 rounded transition-colors ${showSidebar ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:bg-gray-100"}`}>
          <PanelLeft size={16} />
        </button>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        {/* Zoom */}
        <span className="text-xs text-gray-600 min-w-[36px] text-center">{zoomPercent}%</span>
        <button onClick={zoomOut} className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="Alejar"><ZoomOut size={14} /></button>
        <button onClick={zoomIn} className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="Acercar"><ZoomIn size={14} /></button>

        {/* Drag mode */}
        <button onClick={() => setDragMode(!dragMode)} title="Arrastrar"
          className={`p-1.5 rounded transition-colors ${dragMode ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:bg-gray-100"}`}>
          <Hand size={14} />
        </button>

        {/* Fullscreen */}
        <button onClick={goFullscreen} className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="Pantalla completa"><Maximize size={14} /></button>

        <div className="flex-1" />

        {/* Search */}
        <button onClick={() => setShowSearch(!showSearch)} title="Buscar"
          className={`p-1.5 rounded transition-colors ${showSearch ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:bg-gray-100"}`}>
          <Search size={14} />
        </button>

        {/* Settings */}
        <div className="relative">
          <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded" title="Opciones">
            <Settings size={14} />
          </button>
          {showSettings && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[160px]">
              <button onClick={() => { goFullscreen(); setShowSettings(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Maximize size={14} /> Pantalla completa
              </button>
              <button onClick={() => { handlePrint(); setShowSettings(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Printer size={14} /> Imprimir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border-x border-yellow-200 shrink-0">
          <Search size={14} className="text-gray-400" />
          <input
            type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
            placeholder="Buscar en el documento..."
            className="flex-1 text-sm bg-transparent outline-none text-gray-700"
            autoFocus
          />
          <button onClick={() => { setShowSearch(false); setSearchText(""); }} className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
        </div>
      )}

      {/* Main area: sidebar + document */}
      <div className="flex-1 min-h-0 flex overflow-hidden border border-t-0 border-gray-200 rounded-b-lg bg-gray-50">
        {/* Sidebar: page thumbnails */}
        {showSidebar && (
          <div className="w-[100px] bg-white border-r border-gray-200 overflow-y-auto shrink-0 p-1.5 space-y-1.5">
            <Document file={url} onLoadSuccess={() => {}} loading="">
              {Array.from({ length: numPages }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => setCurrentPage(page)}
                  className={`block w-full rounded border-2 transition-colors ${currentPage === page ? "border-blue-500" : "border-transparent hover:border-gray-300"}`}>
                  <Page pageNumber={page} width={80} renderTextLayer={false} renderAnnotationLayer={false} />
                  <p className="text-[9px] text-gray-500 text-center">{page}</p>
                </button>
              ))}
            </Document>
          </div>
        )}

        {/* Document view */}
        <div className={`flex-1 overflow-auto p-3 ${dragMode ? "cursor-grab active:cursor-grabbing" : ""}`}>
          <Document file={url} onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-400" /></div>}
            error={<p className="text-sm text-red-500 text-center py-8">Error cargando PDF.</p>}>
            {Array.from({ length: numPages }, (_, i) => i + 1).map(page => (
              <div key={page} className="mb-3" style={{ width: "fit-content", margin: "0 auto" }}>
                <Page pageNumber={page} scale={scale} className="shadow-sm" />
              </div>
            ))}
          </Document>
        </div>
      </div>
    </div>
  );
}
