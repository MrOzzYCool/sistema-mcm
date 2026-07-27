"use client";

import { useState, useRef } from "react";
import { getAccessToken } from "@/lib/get-token";
import { Loader2, Upload, FileText, CheckCircle } from "lucide-react";

interface PostulacionFormProps {
  ofertaId: string;
  onSuccess: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function PostulacionForm({ ofertaId, onSuccess }: PostulacionFormProps) {
  const [mensaje, setMensaje] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function validateFile(selectedFile: File | null): string {
    if (!selectedFile) {
      return "Debes adjuntar tu CV en formato PDF";
    }
    if (selectedFile.type !== "application/pdf") {
      return "Solo se permiten archivos PDF";
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      return "El archivo no debe exceder 5MB";
    }
    return "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
    setFileError(validateFile(selectedFile));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate file
    const fileValidationError = validateFile(file);
    if (fileValidationError) {
      setFileError(fileValidationError);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sin sesión activa");

      // Step 1: Upload CV
      const formData = new FormData();
      formData.append("file", file!);
      formData.append("oferta_id", ofertaId);

      const uploadRes = await fetch("/api/bolsa-laboral/upload-cv", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        const uploadData = await uploadRes.json();
        throw new Error(uploadData.error ?? "Error al subir el CV");
      }

      const { url: cvUrl } = await uploadRes.json();

      // Step 2: Create postulacion
      const postRes = await fetch("/api/bolsa-laboral/postulaciones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          oferta_id: ofertaId,
          mensaje: mensaje.trim() || null,
          cv_url: cvUrl,
        }),
      });

      if (!postRes.ok) {
        const postData = await postRes.json();
        if (postRes.status === 409) {
          throw new Error("Ya te postulaste a esta oferta");
        }
        throw new Error(postData.error ?? "Error al enviar la postulación");
      }

      // Success
      setSuccess(true);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar la postulación");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <CheckCircle size={32} className="text-green-600 mx-auto mb-3" />
        <p className="text-green-800 font-medium">Postulación enviada exitosamente</p>
        <p className="text-green-600 text-sm mt-1">
          Tu postulación ha sido registrada. Puedes ver el estado en &ldquo;Mis Postulaciones&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Mensaje (optional) */}
      <div>
        <label htmlFor="mensaje" className="block text-sm font-medium text-gray-700 mb-1">
          Mensaje / Carta de presentación{" "}
          <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          id="mensaje"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value.slice(0, 500))}
          maxLength={500}
          rows={4}
          placeholder="Escribe un breve mensaje de presentación..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#C62828] focus:border-transparent focus:outline-none resize-none"
          disabled={submitting}
        />
        <p className="text-xs text-gray-400 mt-1 text-right">
          {mensaje.length}/500 caracteres
        </p>
      </div>

      {/* CV File Upload */}
      <div>
        <label htmlFor="cv-file" className="block text-sm font-medium text-gray-700 mb-1">
          CV en formato PDF <span className="text-red-500">*</span>
        </label>
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
            fileError
              ? "border-red-300 bg-red-50"
              : file
              ? "border-green-300 bg-green-50"
              : "border-gray-300 hover:border-[#C62828]/50 hover:bg-gray-50"
          }`}
        >
          <input
            ref={fileInputRef}
            id="cv-file"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
            disabled={submitting}
          />

          {file && !fileError ? (
            <div className="flex items-center justify-center gap-2">
              <FileText size={20} className="text-green-600" />
              <span className="text-sm text-green-700 font-medium">{file.name}</span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setFileError("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="ml-2 text-xs text-red-600 hover:underline"
                disabled={submitting}
              >
                Quitar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 mx-auto"
              disabled={submitting}
            >
              <Upload size={24} className="text-gray-400" />
              <span className="text-sm text-gray-600">
                Haz clic para seleccionar tu CV
              </span>
              <span className="text-xs text-gray-400">PDF, máximo 5MB</span>
            </button>
          )}
        </div>

        {fileError && (
          <p className="text-xs text-red-600 mt-1">{fileError}</p>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ backgroundColor: submitting ? "#999" : "#D32F2F" }}
        onMouseEnter={(e) => {
          if (!submitting) e.currentTarget.style.backgroundColor = "#C62828";
        }}
        onMouseLeave={(e) => {
          if (!submitting) e.currentTarget.style.backgroundColor = "#D32F2F";
        }}
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Enviando postulación...
          </>
        ) : (
          "Enviar postulación"
        )}
      </button>
    </form>
  );
}
