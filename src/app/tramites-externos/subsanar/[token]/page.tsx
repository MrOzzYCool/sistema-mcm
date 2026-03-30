"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { uploadSolicitudFiles } from "@/lib/solicitudes-service";
import { AlertCircle, CheckCircle, Upload, Loader2, X, Lock } from "lucide-react";

interface SolicitudData {
  id: string;
  nombres: string;
  apellidos: string;
  tipo_tramite: string;
  estado: string;
  observaciones: { voucher?: string; dni_anverso?: string; dni_reverso?: string } | null;
  voucher_url: string;
  dni_anverso_url: string;
  dni_reverso_url: string;
}

export default function SubsanarPage() {
  const { token } = useParams<{ token: string }>();

  const [solicitud, setSolicitud]   = useState<SolicitudData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [enviado, setEnviado]       = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [voucherFile, setVoucherFile]       = useState<File | null>(null);
  const [dniAnversoFile, setDniAnversoFile] = useState<File | null>(null);
  const [dniReversoFile, setDniReversoFile] = useState<File | null>(null);
  const voucherRef    = useRef<HTMLInputElement>(null);
  const dniAnversoRef = useRef<HTMLInputElement>(null);
  const dniReversoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/solicitudes/subsanar?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSolicitud(data);
      })
      .catch(() => setError("Error cargando la solicitud"))
      .finally(() => setLoading(false));
  }, [token]);

  const obs = solicitud?.observaciones ?? {};
  const dni = solicitud?.id?.slice(0, 8) ?? "dni";

  // Solo los campos con observación son obligatorios
  const puedeEnviar =
    (!obs.voucher     || !!voucherFile) &&
    (!obs.dni_anverso || !!dniAnversoFile) &&
    (!obs.dni_reverso || !!dniReversoFile);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!solicitud || !puedeEnviar) return;
    setSubmitting(true);
    setError("");

    try {
      const updates: Record<string, string> = {};

      // Subir solo los archivos que cambiaron
      if (voucherFile || dniAnversoFile || dniReversoFile) {
        const { voucherUrl, dniAnversoUrl, dniReversoUrl } = await uploadSolicitudFiles(
          dni,
          voucherFile    ?? new File([], ""),
          dniAnversoFile ?? new File([], ""),
          dniReversoFile ?? new File([], ""),
        );
        if (voucherFile)    updates.voucher_url     = voucherUrl;
        if (dniAnversoFile) updates.dni_anverso_url = dniAnversoUrl;
        if (dniReversoFile) updates.dni_reverso_url = dniReversoUrl;
      }

      const res = await fetch("/api/solicitudes/subsanar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...updates }),
      });

      if (!res.ok) {
        const { error: e } = await res.json();
        throw new Error(e);
      }

      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Estados de pantalla ──────────────────────────────────────────────────

  if (loading) {
    return (
      <Wrapper>
        <div className="flex items-center justify-center py-20 gap-3 text-white/70">
          <Loader2 size={22} className="animate-spin" />
          <span>Cargando solicitud...</span>
        </div>
      </Wrapper>
    );
  }

  if (error && !solicitud) {
    return (
      <Wrapper>
        <div className="bg-white rounded-2xl p-8 text-center max-w-md mx-auto">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="font-bold text-mcm-text text-lg mb-2">Enlace inválido</h2>
          <p className="text-mcm-muted text-sm">{error}</p>
        </div>
      </Wrapper>
    );
  }

  if (enviado) {
    return (
      <Wrapper>
        <div className="bg-white rounded-2xl p-10 text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-mcm-text mb-2">¡Corrección enviada!</h2>
          <p className="text-mcm-muted text-sm">
            Tu solicitud volvió a estado <strong>Pendiente</strong>. Te avisaremos cuando sea revisada.
          </p>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Info de la solicitud */}
        <div className="bg-white/10 border border-white/20 rounded-2xl p-5">
          <p className="text-white font-semibold">{solicitud?.nombres} {solicitud?.apellidos}</p>
          <p className="text-white/70 text-sm mt-1">{solicitud?.tipo_tramite}</p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-mcm-text mb-1">Corregir documentos observados</h2>
          <p className="text-mcm-muted text-sm mb-6">
            Solo los documentos marcados en rojo necesitan ser reemplazados.
          </p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <CampoArchivo
              label="Voucher de pago"
              observacion={obs.voucher}
              file={voucherFile}
              inputRef={voucherRef}
              onChange={setVoucherFile}
              urlActual={solicitud?.voucher_url}
            />
            <CampoArchivo
              label="DNI — Anverso"
              observacion={obs.dni_anverso}
              file={dniAnversoFile}
              inputRef={dniAnversoRef}
              onChange={setDniAnversoFile}
              urlActual={solicitud?.dni_anverso_url}
            />
            <CampoArchivo
              label="DNI — Reverso"
              observacion={obs.dni_reverso}
              file={dniReversoFile}
              inputRef={dniReversoRef}
              onChange={setDniReversoFile}
              urlActual={solicitud?.dni_reverso_url}
            />

            <button
              type="submit"
              disabled={!puedeEnviar || submitting}
              className="w-full btn-primary py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? "Enviando corrección..." : "Enviar corrección"}
            </button>
          </form>
        </div>
      </div>
    </Wrapper>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen p-6" style={{ background: "linear-gradient(160deg,#a93526 0%,#8a2b1f 100%)" }}>
      <div className="max-w-2xl mx-auto mb-6 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-blanco.png" alt="Logo" style={{ width: 50, height: "auto" }} />
        <div>
          <p className="text-white font-bold text-sm">I.E.S. Privada Margarita Cabrera</p>
          <p className="text-white/60 text-xs">Corrección de documentos</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function CampoArchivo({ label, observacion, file, inputRef, onChange, urlActual }: {
  label: string;
  observacion?: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (f: File | null) => void;
  urlActual?: string;
}) {
  const tieneObservacion = !!observacion;

  return (
    <div className={`rounded-xl border-2 p-4 ${tieneObservacion ? "border-red-300 bg-red-50" : "border-mcm-border bg-slate-50"}`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-sm font-semibold ${tieneObservacion ? "text-red-700" : "text-mcm-muted"}`}>
          {tieneObservacion ? "⚠️ " : <Lock size={12} className="inline mr-1" />}{label}
        </p>
        {!tieneObservacion && (
          <span className="text-xs text-mcm-muted bg-slate-200 px-2 py-0.5 rounded-full">Sin cambios</span>
        )}
      </div>

      {tieneObservacion && (
        <p className="text-xs text-red-600 mb-3 bg-red-100 rounded-lg px-3 py-2">{observacion}</p>
      )}

      {tieneObservacion ? (
        // Campo editable
        file ? (
          <div className="border-2 border-green-400 bg-green-50 rounded-xl overflow-hidden">
            <div className="relative w-full h-24 bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-green-700 text-xs font-medium truncate flex-1">{file.name}</p>
              <button type="button" onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ""; }}
                className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center shrink-0">
                <X size={12} />
              </button>
            </div>
          </div>
        ) : (
          <div onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-red-300 hover:border-[#a93526] hover:bg-red-100 rounded-xl p-4 text-center cursor-pointer transition-colors">
            <Upload size={18} className="text-red-400 mx-auto mb-1" />
            <p className="text-xs text-red-500">Haz clic para subir el documento corregido</p>
          </div>
        )
      ) : (
        // Campo bloqueado — muestra imagen actual
        <div className="rounded-xl overflow-hidden border border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urlActual} alt={label} className="w-full h-20 object-contain bg-white" />
          <p className="text-xs text-center text-mcm-muted py-1.5 bg-slate-100">Documento actual (no requiere cambio)</p>
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) onChange(e.target.files[0]); }} />
    </div>
  );
}
