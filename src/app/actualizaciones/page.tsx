"use client";

import { useState, useRef } from "react";
import { ACTUALIZACIONES_CATALOGO } from "@/lib/mock-data";
import { uploadSolicitudFiles } from "@/lib/solicitudes-service";
import {
  AlertCircle, CheckCircle, Upload, CreditCard, Smartphone,
  Copy, Check, Info, Loader2, X,
} from "lucide-react";

// ─── Botón copiar ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 shrink-0 ${
        copied ? "bg-green-500/80 text-white" : "bg-white/20 hover:bg-white/30 text-white"
      }`}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "¡Copiado!" : "Copiar"}
    </button>
  );
}

// ─── Tipos ─────────────────────────────────────────────────────────────────────

type FormState = {
  nombres: string; apellidos: string; dni: string;
  email: string; emailConfirm: string; celular: string;
  actualizacionId: string;
  tipoComprobante: "boleta" | "factura" | "";
  ruc: string; razonSocial: string; direccionFiscal: string;
};

const INIT: FormState = {
  nombres: "", apellidos: "", dni: "", email: "", emailConfirm: "",
  celular: "", actualizacionId: "",
  tipoComprobante: "", ruc: "", razonSocial: "", direccionFiscal: "",
};

// ─── Página ────────────────────────────────────────────────────────────────────

export default function ActualizacionesPage() {
  const [form, setForm]                         = useState<FormState>(INIT);
  const [voucherFiles, setVoucherFiles]         = useState<File[]>([]);
  const [dniAnversoFile, setDniAnversoFile]     = useState<File | null>(null);
  const [dniReversoFile, setDniReversoFile]     = useState<File | null>(null);
  const [enviado, setEnviado]                   = useState(false);
  const [error, setError]                       = useState("");
  const [submitting, setSubmitting]             = useState(false);
  const voucherRef    = useRef<HTMLInputElement>(null);
  const dniAnversoRef = useRef<HTMLInputElement>(null);
  const dniReversoRef = useRef<HTMLInputElement>(null);

  const actualizacion    = ACTUALIZACIONES_CATALOGO.find((a) => a.id === form.actualizacionId);
  const emailNoCoincide  = form.emailConfirm.length > 0 && form.email !== form.emailConfirm;

  const puedeEnviar =
    !!actualizacion &&
    voucherFiles.length > 0 && !!dniAnversoFile && !!dniReversoFile &&
    !!form.email && !!form.emailConfirm && !emailNoCoincide &&
    !!form.tipoComprobante &&
    (form.tipoComprobante === "boleta" || (
      form.ruc.length === 11 && !!form.razonSocial.trim() && !!form.direccionFiscal.trim()
    ));

  function set(k: keyof FormState, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeEnviar || !actualizacion) return;
    setError("");
    setSubmitting(true);

    try {
      const supabaseConfigurado =
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("TU_PROYECTO");

      let voucherUrl    = voucherFiles.map((f) => URL.createObjectURL(f)).join(",");
      let dniAnversoUrl = URL.createObjectURL(dniAnversoFile!);
      let dniReversoUrl = URL.createObjectURL(dniReversoFile!);

      if (supabaseConfigurado) {
        const { voucherUrl: vu, dniAnversoUrl: dau, dniReversoUrl: dru, paths } =
          await uploadSolicitudFiles(form.dni, voucherFiles, dniAnversoFile!, dniReversoFile!);

        try {
          const res = await fetch("/api/solicitudes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nombres:          form.nombres.trim(),
              apellidos:        form.apellidos.trim(),
              dni:              form.dni.trim(),
              email:            form.email.trim().toLowerCase(),
              celular:          form.celular.trim(),
              anio_egreso:      "—",
              tipo_tramite:     actualizacion.label,
              costo_tramite:    actualizacion.costo,
              monto_pagado:     actualizacion.costo,
              voucher_url:      vu,
              dni_anverso_url:  dau,
              dni_reverso_url:  dru,
              tipo_comprobante: form.tipoComprobante,
              tipo_formulario:  "actualizacion",
              ...(form.tipoComprobante === "factura" && {
                ruc:              form.ruc,
                razon_social:     form.razonSocial.trim(),
                direccion_fiscal: form.direccionFiscal.trim(),
              }),
            }),
          });

          if (!res.ok) {
            const { error: apiError } = await res.json();
            const { supabase: sb } = await import("@/lib/supabase");
            await sb.storage.from("tramites-mcm").remove(paths);
            throw new Error(apiError ?? "Error al guardar la solicitud");
          }

          voucherUrl    = vu;
          dniAnversoUrl = dau;
          dniReversoUrl = dru;
        } catch (dbErr) {
          throw dbErr;
        }
      }

      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Pantalla de éxito ───────────────────────────────────────────────────────

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6"
        style={{ background: "linear-gradient(160deg,#a93526 0%,#8a2b1f 100%)" }}>
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-mcm-text mb-2">¡Solicitud enviada!</h2>
          <p className="text-mcm-muted text-sm mb-6">
            Tu solicitud fue registrada. Te contactaremos al correo <strong>{form.email}</strong>.
          </p>
          <button onClick={() => { setForm(INIT); setVoucherFiles([]); setDniAnversoFile(null); setDniReversoFile(null); setEnviado(false); }}
            className="btn-primary w-full py-2.5 text-sm">
            Enviar otra solicitud
          </button>
          <div className="flex justify-center mt-3">
            <button onClick={() => window.close()} className="btn-primary px-8 py-2 text-sm">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Formulario ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg,#a93526 0%,#8a2b1f 100%)" }}>

      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-blanco.png" alt="Logo" style={{ width: 60, height: "auto" }} />
        <div>
          <p className="text-white font-bold text-sm">I.E.S. Privada Margarita Cabrera</p>
          <p className="text-white/60 text-xs">Solicitud de Actualizaciones</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Cuentas bancarias */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/20">
          <p className="text-white font-semibold mb-3 text-sm">Realiza tu pago en:</p>
          <div className="grid grid-cols-1 md:grid-cols-[1.65fr_1fr] gap-3">
            <div className="bg-white/10 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard size={22} className="text-white" />
                <span className="text-white font-bold text-2xl tracking-wide">BCP</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-white/90 text-base font-semibold mb-1.5">Cuenta</p>
                  <p className="text-white font-bold text-xl font-mono tracking-wide">194-8299268-0-87</p>
                </div>
                <CopyButton text="1948299268087" />
              </div>
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
                <div>
                  <p className="text-white/90 text-base font-semibold mb-1.5">CCI</p>
                  <p className="text-white font-bold text-lg md:text-xl font-mono tracking-wide">002-194-008299268087-94</p>
                </div>
                <CopyButton text="00219400829926808794" />
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-3">
              <div className="flex items-center gap-2">
                <Smartphone size={22} className="text-white" />
                <span className="text-white font-bold text-2xl tracking-wide">Yape</span>
              </div>
              <div>
                <p className="text-white/90 text-base font-semibold mb-1.5">Número</p>
                <p className="text-white font-bold text-2xl font-mono tracking-wide whitespace-nowrap">997503390</p>
              </div>
              <CopyButton text="997503390" />
            </div>
          </div>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-mcm-text mb-1">Solicitud de Actualización</h2>
          <p className="text-mcm-muted text-sm mb-6">Completa todos los campos y adjunta tu voucher de pago y DNI.</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Datos personales */}
            <fieldset>
              <legend className="text-xs font-semibold text-mcm-muted uppercase tracking-wide mb-3">Datos personales</legend>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Nombres" value={form.nombres} onChange={(v) => set("nombres", v.toUpperCase())} placeholder="Ej: MARÍA ELENA" required style={{ textTransform: "uppercase" }} />
                <Field label="Apellidos" value={form.apellidos} onChange={(v) => set("apellidos", v.toUpperCase())} placeholder="Ej: GARCÍA LÓPEZ" required style={{ textTransform: "uppercase" }} />
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1.5">DNI</label>
                  <input type="text" value={form.dni}
                    onChange={(e) => set("dni", e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="12345678" inputMode="numeric" maxLength={8} required
                    className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526]" />
                </div>
                <Field label="Celular" value={form.celular} onChange={(v) => set("celular", v)} placeholder="987654321" required />
                <Field label="Correo electrónico" value={form.email} onChange={(v) => set("email", v)} type="email" placeholder="correo@gmail.com" required />
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1.5">Confirmar correo electrónico</label>
                  <input type="email" value={form.emailConfirm}
                    onChange={(e) => set("emailConfirm", e.target.value)}
                    placeholder="correo@gmail.com" required
                    className={`w-full border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
                      emailNoCoincide ? "border-red-400 bg-red-50 focus:ring-red-400" : "border-mcm-border focus:ring-[#a93526]"
                    }`} />
                  {emailNoCoincide && (
                    <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> Los correos electrónicos no coinciden
                    </p>
                  )}
                </div>
              </div>
            </fieldset>

            {/* Actualización */}
            <fieldset>
              <legend className="text-xs font-semibold text-mcm-muted uppercase tracking-wide mb-3">Actualización a realizar</legend>
              <div className="space-y-3">
                <select value={form.actualizacionId}
                  onChange={(e) => set("actualizacionId", e.target.value)}
                  required
                  className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526]">
                  <option value="">Selecciona una actualización...</option>
                  {ACTUALIZACIONES_CATALOGO.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>

                {actualizacion && (
                  <div className="flex items-center justify-between bg-[#a93526] rounded-xl px-5 py-4">
                    <span className="text-white font-medium text-sm">Monto a pagar:</span>
                    <span className="text-white font-bold text-2xl">S/ {actualizacion.costo.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </fieldset>

            {/* Comprobante */}
            <fieldset>
              <legend className="text-xs font-semibold text-mcm-muted uppercase tracking-wide mb-3">Tipo de comprobante</legend>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {(["boleta", "factura"] as const).map((tipo) => (
                    <button key={tipo} type="button" onClick={() => set("tipoComprobante", tipo)}
                      className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        form.tipoComprobante === tipo
                          ? "border-[#a93526] bg-red-50 text-[#a93526]"
                          : "border-mcm-border text-mcm-muted hover:border-[#a93526]"
                      }`}>
                      {tipo === "boleta" ? "🧾 Boleta" : "📄 Factura"}
                    </button>
                  ))}
                </div>
                {form.tipoComprobante === "factura" && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-sm font-medium text-mcm-text mb-1.5">RUC <span className="text-red-500">*</span></label>
                      <input type="text" value={form.ruc}
                        onChange={(e) => set("ruc", e.target.value.replace(/\D/g, "").slice(0, 11))}
                        placeholder="20123456789" inputMode="numeric" maxLength={11} required
                        className={`w-full border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526] ${
                          form.ruc.length > 0 && form.ruc.length !== 11 ? "border-red-400 bg-red-50" : "border-mcm-border"
                        }`} />
                      {form.ruc.length > 0 && form.ruc.length !== 11 && (
                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} /> El RUC debe tener 11 dígitos</p>
                      )}
                    </div>
                    <Field label="Razón Social *" value={form.razonSocial} onChange={(v) => set("razonSocial", v.toUpperCase())} placeholder="EMPRESA S.A.C." required style={{ textTransform: "uppercase" }} />
                    <Field label="Dirección Fiscal *" value={form.direccionFiscal} onChange={(v) => set("direccionFiscal", v)} placeholder="Av. Principal 123, Lima" required />
                  </div>
                )}
              </div>
            </fieldset>

            {/* Archivos */}
            <fieldset>
              <legend className="text-xs font-semibold text-mcm-muted uppercase tracking-wide mb-3">Documentos adjuntos</legend>
              <div className="space-y-4">
                <MultiFileUpload label="Voucher(s) de pago" sublabel="Puedes subir varios comprobantes"
                  files={voucherFiles} inputRef={voucherRef} onChange={setVoucherFiles} />
                <DniFileUpload label="DNI — Anverso" sublabel="Parte delantera"
                  file={dniAnversoFile} inputRef={dniAnversoRef} onChange={setDniAnversoFile} />
                <DniFileUpload label="DNI — Reverso" sublabel="Parte trasera"
                  file={dniReversoFile} inputRef={dniReversoRef} onChange={setDniReversoFile} />
              </div>
            </fieldset>

            <button type="submit" disabled={!puedeEnviar || submitting}
              className="w-full btn-primary py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? "Enviando..." : "Enviar solicitud"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = "text", placeholder, required, style }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; style?: React.CSSProperties;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-mcm-text mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required={required} style={style}
        className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526]" />
    </div>
  );
}

function MultiFileUpload({ label, sublabel, files, inputRef, onChange }: {
  label: string; sublabel?: string; files: File[];
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (files: File[]) => void;
}) {
  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    onChange([...files, ...Array.from(newFiles)]);
    if (inputRef.current) inputRef.current.value = "";
  }
  return (
    <div>
      <label className="block text-sm font-medium text-mcm-text mb-0.5">{label}</label>
      {sublabel && <p className="text-xs text-mcm-muted mb-2">{sublabel}</p>}
      {files.length > 0 && (
        <div className="space-y-2 mb-3">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-green-50 border border-green-300 rounded-xl overflow-hidden">
              <div className="w-14 h-14 shrink-0 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-contain" />
              </div>
              <p className="flex-1 text-xs text-green-700 font-medium truncate">{f.name}</p>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="mr-2 w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-mcm-border hover:border-[#a93526] hover:bg-red-50 rounded-xl p-4 text-center cursor-pointer transition-colors">
        <Upload size={20} className="text-mcm-muted mx-auto mb-1" />
        <p className="text-xs text-mcm-muted font-medium">{files.length > 0 ? "Agregar más vouchers" : "Haz clic para subir"}</p>
        <p className="text-xs text-mcm-muted">JPG, PNG — puedes seleccionar varios</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => addFiles(e.target.files)} />
    </div>
  );
}

function DniFileUpload({ label, sublabel, file, inputRef, onChange }: {
  label: string; sublabel?: string; file: File | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (f: File | null) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-sm font-medium text-mcm-text mb-0.5">{label}</label>
      {sublabel && <p className="text-xs text-mcm-muted mb-2">{sublabel}</p>}
      {file ? (
        <div className="border-2 border-green-400 bg-green-50 rounded-xl overflow-hidden">
          <div className="w-full h-28 bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-contain" />
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-green-700 text-xs font-medium truncate flex-1">{file.name}</p>
            <button type="button" onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ""; if (cameraRef.current) cameraRef.current.value = ""; }}
              className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center shrink-0">
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-mcm-border hover:border-[#a93526] hover:bg-red-50 rounded-xl p-3 text-center cursor-pointer transition-colors">
            <Upload size={18} className="text-mcm-muted mx-auto mb-1" />
            <p className="text-xs text-mcm-muted">Subir archivo</p>
          </div>
          <div onClick={() => cameraRef.current?.click()}
            className="border-2 border-dashed border-mcm-border hover:border-[#a93526] hover:bg-red-50 rounded-xl p-3 text-center cursor-pointer transition-colors">
            <span className="text-lg block mb-0.5">📷</span>
            <p className="text-xs text-mcm-muted">Tomar foto</p>
          </div>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) onChange(e.target.files[0]); }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) onChange(e.target.files[0]); }} />
    </div>
  );
}
