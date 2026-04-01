"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";

// ─── Campo de correo con bloqueo de copy ──────────────────────────────────────

export function EmailField({ value, onChange }: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-mcm-text mb-1.5">
        Correo electrónico
      </label>
      <input
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="correo@gmail.com"
        required
        // Bloquear copiar desde este campo
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        className="w-full border border-mcm-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526]"
      />
    </div>
  );
}

// ─── Campo de confirmación con bloqueo de paste ───────────────────────────────

export function EmailConfirmField({ value, onChange, emailOriginal }: {
  value: string;
  onChange: (v: string) => void;
  emailOriginal: string;
}) {
  const [pasteWarning, setPasteWarning] = useState(false);

  const noCoincide = value.length > 0 && value !== emailOriginal;

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    setPasteWarning(true);
    setTimeout(() => setPasteWarning(false), 3000);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-mcm-text mb-1.5">
        Confirmar correo electrónico
      </label>
      <input
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="correo@gmail.com"
        required
        onPaste={handlePaste}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        // Deshabilitar autocompletado para forzar escritura manual
        autoComplete="off"
        className={`w-full border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
          noCoincide
            ? "border-red-400 bg-red-50 focus:ring-red-400"
            : "border-mcm-border focus:ring-[#a93526]"
        }`}
      />
      {pasteWarning && (
        <p className="text-amber-600 text-xs mt-1 flex items-center gap-1 font-medium">
          <AlertCircle size={12} />
          Por seguridad, por favor escribe tu correo manualmente.
        </p>
      )}
      {!pasteWarning && noCoincide && (
        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
          <AlertCircle size={12} />
          Los correos electrónicos no coinciden
        </p>
      )}
    </div>
  );
}
