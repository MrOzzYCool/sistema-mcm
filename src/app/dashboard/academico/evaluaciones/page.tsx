"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import RouteGuard from "@/components/RouteGuard";
import {
  Loader2, Save, Plus, Trash2, ArrowLeft, Wand2, AlertCircle, CheckCircle,
} from "lucide-react";

interface Rubro {
  nombre_concepto: string;
  porcentaje: number;
  orden: number;
}

const PLANTILLA_DEFAULT: Rubro[] = [
  { nombre_concepto: "Contribución a la clase", porcentaje: 25, orden: 1 },
  { nombre_concepto: "Controles y ejercicios", porcentaje: 35, orden: 2 },
  { nombre_concepto: "Examen final", porcentaje: 40, orden: 3 },
];

function EvaluacionesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cursoId = searchParams.get("curso_id");
  const cursoNombre = searchParams.get("nombre") ?? "Curso";

  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  // Load existing evaluations
  useEffect(() => {
    if (!cursoId) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/evaluaciones?curso_id=${cursoId}`, {
          headers: { Authorization: `Bearer ${await getToken()}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRubros(data.evaluaciones?.length > 0
            ? data.evaluaciones.map((e: Rubro) => ({
                nombre_concepto: e.nombre_concepto,
                porcentaje: e.porcentaje,
                orden: e.orden,
              }))
            : []
          );
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
  }, [cursoId]);

  const suma = rubros.reduce((s, r) => s + (r.porcentaje || 0), 0);
  const isValid = rubros.length > 0 && suma === 100 && rubros.every(r => r.nombre_concepto.trim() && r.porcentaje > 0);

  function addRubro() {
    setRubros([...rubros, { nombre_concepto: "", porcentaje: 0, orden: rubros.length + 1 }]);
  }

  function removeRubro(index: number) {
    setRubros(rubros.filter((_, i) => i !== index).map((r, i) => ({ ...r, orden: i + 1 })));
  }

  function updateRubro(index: number, field: keyof Rubro, value: string | number) {
    setRubros(rubros.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  function applyTemplate() {
    setRubros([...PLANTILLA_DEFAULT]);
    setSuccess("");
    setError("");
  }

  async function handleSave() {
    if (!cursoId || !isValid) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/evaluaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ curso_id: cursoId, evaluaciones: rubros }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSuccess(`Evaluaciones guardadas correctamente (${json.count} rubros).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (!cursoId) {
    return (
      <div className="p-6">
        <div className="card text-center py-12">
          <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
          <p className="text-mcm-text font-bold">Falta el parámetro curso_id</p>
          <button onClick={() => router.back()} className="btn-secondary text-sm mt-4">Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 w-full space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-mcm-muted hover:text-mcm-text">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Configurar Evaluaciones</h1>
          <p className="text-mcm-muted text-sm">{cursoNombre}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted">
          <Loader2 size={20} className="animate-spin" /> Cargando...
        </div>
      ) : (
        <>
          {/* Template button */}
          <div className="flex items-center gap-3">
            <button onClick={applyTemplate}
              className="btn-secondary flex items-center gap-2 text-sm">
              <Wand2 size={14} /> Aplicar plantilla 25/35/40
            </button>
            <button onClick={addRubro}
              className="btn-secondary flex items-center gap-2 text-sm">
              <Plus size={14} /> Agregar rubro
            </button>
          </div>

          {/* Rubros editor */}
          <div className="card overflow-hidden p-0">
            <div className="px-6 py-4 border-b border-mcm-border flex items-center justify-between">
              <h2 className="font-semibold text-mcm-text">Rubros de evaluación</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-mcm-muted">Total:</span>
                <span className={`text-lg font-bold ${suma === 100 ? "text-green-700" : "text-red-600"}`}>
                  {suma}%
                </span>
                {suma !== 100 && <span className="text-xs text-red-500">(debe ser 100%)</span>}
              </div>
            </div>

            {rubros.length === 0 ? (
              <div className="py-12 text-center text-mcm-muted text-sm">
                No hay rubros configurados. Usa &ldquo;Aplicar plantilla&rdquo; o &ldquo;Agregar rubro&rdquo;.
              </div>
            ) : (
              <div className="divide-y divide-mcm-border">
                {rubros.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-6 py-3">
                    <span className="text-mcm-muted text-xs font-mono w-6 shrink-0">{i + 1}.</span>
                    <input
                      value={r.nombre_concepto}
                      onChange={e => updateRubro(i, "nombre_concepto", e.target.value)}
                      placeholder="Nombre del concepto"
                      className="flex-1 border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526] focus:outline-none"
                    />
                    <div className="flex items-center gap-1 w-24 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={r.porcentaje || ""}
                        onChange={e => updateRubro(i, "porcentaje", parseInt(e.target.value) || 0)}
                        className="w-16 border border-mcm-border rounded-lg px-2 py-2 text-sm text-center focus:ring-2 focus:ring-[#a93526] focus:outline-none"
                      />
                      <span className="text-mcm-muted text-sm">%</span>
                    </div>
                    <button onClick={() => removeRubro(i)} title="Eliminar rubro"
                      className="text-mcm-muted hover:text-red-600 shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Progress bar */}
          {rubros.length > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${suma === 100 ? "bg-green-500" : suma > 100 ? "bg-red-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(suma, 100)}%` }}
              />
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving || !isValid}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function EvaluacionesPage() {
  return (
    <RouteGuard allowedRoles={["super_admin"]}>
      <EvaluacionesContent />
    </RouteGuard>
  );
}
