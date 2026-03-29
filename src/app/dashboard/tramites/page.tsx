"use client";

import { useState } from "react";
import { MOCK_TRAMITES, TRAMITE_TIPOS, Tramite, formatFecha } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";
import { EstadoBadge } from "@/components/EstadoBadge";
import { FileText, Plus, CheckCircle, XCircle, Upload, Clock } from "lucide-react";
import clsx from "clsx";

export default function TramitesPage() {
  const { user } = useAuth();
  const [tramites, setTramites] = useState<Tramite[]>(MOCK_TRAMITES);
  const [showNuevo, setShowNuevo] = useState(false);
  const [form, setForm] = useState({ tipo: TRAMITE_TIPOS[0], descripcion: "" });

  function solicitarTramite() {
    if (!form.descripcion.trim()) return;
    const nuevo: Tramite = {
      id: `t${Date.now()}`,
      tipo: form.tipo,
      descripcion: form.descripcion,
      fechaSolicitud: new Date().toISOString().split("T")[0],
      estado: "pendiente",
      alumnoId: user!.id,
      alumnoNombre: user!.name,
    };
    setTramites((prev) => [nuevo, ...prev]);
    setForm({ tipo: TRAMITE_TIPOS[0], descripcion: "" });
    setShowNuevo(false);
  }

  function cambiarEstado(id: string, estado: Tramite["estado"]) {
    setTramites((prev) => prev.map((t) => (t.id === id ? { ...t, estado } : t)));
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Trámites</h1>
          <p className="text-mcm-muted text-sm mt-0.5">Solicita y da seguimiento a tus documentos</p>
        </div>
        {user?.role === "alumno" && (
          <button onClick={() => setShowNuevo(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Nueva solicitud
          </button>
        )}
      </div>

      {/* Catálogo (solo alumno) */}
      {user?.role === "alumno" && (
        <div className="card">
          <h2 className="font-semibold text-mcm-text mb-4">Documentos disponibles</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TRAMITE_TIPOS.map((tipo) => (
              <button
                key={tipo}
                onClick={() => { setForm({ tipo, descripcion: "" }); setShowNuevo(true); }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-mcm-border hover:border-mcm-primary hover:bg-red-50 transition-all text-center group"
              >
                <div className="w-10 h-10 bg-red-50 group-hover:bg-red-100 rounded-xl flex items-center justify-center transition-colors">
                  <FileText className="w-5 h-5 text-mcm-primary" />
                </div>
                <span className="text-xs font-medium text-mcm-text leading-tight">{tipo}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabla de trámites */}
      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-mcm-border flex items-center gap-2">
          <Clock className="w-4 h-4 text-mcm-muted" />
          <h2 className="font-semibold text-mcm-text">
            {user?.role === "super_admin" ? "Todas las solicitudes" : "Mis solicitudes"}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Tipo de trámite", user?.role === "super_admin" ? "Alumno" : null, "Fecha", "Estado", "Acciones"]
                  .filter(Boolean)
                  .map((h) => (
                    <th key={h as string} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {tramites.map((t) => (
                <tr key={t.id} className="border-t border-mcm-border hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-medium text-mcm-text">{t.tipo}</p>
                    <p className="text-xs text-mcm-muted mt-0.5">{t.descripcion}</p>
                  </td>
                  {user?.role === "super_admin" && (
                    <td className="py-3.5 px-4 text-mcm-muted">{t.alumnoNombre}</td>
                  )}
                  <td className="py-3.5 px-4 text-mcm-muted">{formatFecha(t.fechaSolicitud)}</td>
                  <td className="py-3.5 px-4"><EstadoBadge estado={t.estado} /></td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      {t.estado === "aprobado" && (
                        <a href={t.documentoUrl ?? "#"} className="flex items-center gap-1 text-xs text-mcm-primary hover:underline font-medium">
                          <Upload size={13} /> Descargar
                        </a>
                      )}
                      {user?.role === "super_admin" && t.estado === "pendiente" && (
                        <>
                          <button
                            onClick={() => cambiarEstado(t.id, "en_proceso")}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            <Clock size={13} /> Procesar
                          </button>
                          <button
                            onClick={() => cambiarEstado(t.id, "rechazado")}
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            <XCircle size={13} /> Rechazar
                          </button>
                        </>
                      )}
                      {user?.role === "super_admin" && t.estado === "en_proceso" && (
                        <button
                          onClick={() => cambiarEstado(t.id, "aprobado")}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium"
                        >
                          <CheckCircle size={13} /> Aprobar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal nueva solicitud */}
      {showNuevo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-mcm-text text-lg mb-4">Nueva solicitud de trámite</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1.5">Tipo de documento</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary"
                >
                  {TRAMITE_TIPOS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1.5">Motivo / descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Ej: Para trámite bancario, prácticas profesionales..."
                  rows={3}
                  className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mcm-primary resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNuevo(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={solicitarTramite} className="btn-primary flex-1 text-sm">Enviar solicitud</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
