"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import RouteGuard from "@/components/RouteGuard";
import { supabase } from "@/lib/supabase";
import {
  UserPlus, RefreshCw, Loader2, Search, Download, Upload,
  CheckCircle, XCircle, Key, X, UserX, GraduationCap, CreditCard,
} from "lucide-react";
import clsx from "clsx";

interface Profile {
  id: string; nombre_completo: string; email: string;
  rol: string; estado: string; dni: string | null; created_at: string;
}

function UsuariosContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles]   = useState<Profile[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [filtroRol, setFiltroRol] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

  // Enrollment modal state
  const [enrollModal, setEnrollModal] = useState<{ show: boolean; target: Profile | null }>({ show: false, target: null });
  const [enrollForm, setEnrollForm] = useState({ carrera_id: "", ciclo: "1", fecha_inicio_ciclo: "" });
  const [enrollSaving, setEnrollSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    tipo: "alumno", nombres: "", apellidos: "", email: "", dni: "",
    password: "", auto_password: true, force_change: true, notify_email: true,
    carrera_id: "", ciclo_inicial: "1", fecha_inicio_ciclo: "",
  });
  const [carrerasDisp, setCarrerasDisp] = useState<{ id: string; nombre_carrera: string; duracion_ciclos: number }[]>([]);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      const data = await res.json();
      console.log("Usuarios cargados:", data);
      if (!res.ok) throw new Error(data.error);
      // Solo mostrar alumnos y profesores en este módulo
      setProfiles(data.filter((p: Profile) => p.rol === "alumno" || p.rol === "profesor"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Cargar carreras para el selector
  useEffect(() => {
    async function loadCarreras() {
      const token = await getToken();
      const res = await fetch("/api/admin/academico?tipo=carreras", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setCarrerasDisp(data.map((c: { id: string; nombre_carrera: string; duracion_ciclos: number }) => ({
          id: c.id, nombre_carrera: c.nombre_carrera, duracion_ciclos: c.duracion_ciclos,
        })));
      }
    }
    loadCarreras();
  }, []);

  async function handleCreate() {
    setSaving(true); setError("");
    try {
      const nombre_completo = `${form.nombres.trim()} ${form.apellidos.trim()}`.trim();
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ ...form, nombre_completo }),
      });
      const json = await res.json();
      console.log("Respuesta del servidor:", json);
      if (!res.ok && res.status !== 207) throw new Error(json.error);
      if (res.status === 207) {
        setError(`⚠️ Usuario creado en Auth pero NO en profiles: ${json.error}. Verifica permisos de la tabla profiles.`);
      }
      setShowModal(false);
      setForm({ tipo: "alumno", nombres: "", apellidos: "", email: "", dni: "", password: "", auto_password: true, force_change: true, notify_email: true, carrera_id: "", ciclo_inicial: "1", fecha_inicio_ciclo: "" });
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset(userId: string) {
    if (!confirm("¿Resetear contraseña de este usuario?")) return;
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ userId, notify_email: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      alert("Contraseña reseteada y enviada por email.");
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }

  async function handleToggle(userId: string, estadoActual: string) {
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";
    try {
      const res = await fetch("/api/admin/toggle-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ userId, estado: nuevoEstado }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }

  async function handlePurge(p: Profile) {
    if (p.id === user?.id) { setError("No puedes eliminar tu propia cuenta"); return; }
    const msg = `⚠️ ELIMINAR USUARIO DE PRUEBA ⚠️\n\n"${p.nombre_completo}" (${p.email})\n\nEsta acción eliminará COMPLETAMENTE al usuario:\n• Se borrará de Supabase Auth\n• Se borrará su perfil\n• Se borrarán inscripciones, historial y cursos\n\nPodrás crear otro usuario con el mismo email/DNI después.\n\n¿Continuar?`;
    if (!confirm(msg)) return;
    // Doble confirmación
    if (!confirm(`¿Estás SEGURO? Esta acción es IRREVERSIBLE.\n\nUsuario: ${p.nombre_completo}\nEmail: ${p.email}`)) return;
    try {
      const res = await fetch("/api/admin/purge-test-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ userId: p.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      alert(json.message ?? "Usuario de prueba eliminado completamente.");
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }

  function openEnrollModal(p: Profile) {
    setEnrollForm({ carrera_id: "", ciclo: "1", fecha_inicio_ciclo: "" });
    setEnrollModal({ show: true, target: p });
  }

  async function handleEnroll() {
    if (!enrollModal.target || !enrollForm.carrera_id) return;
    setEnrollSaving(true); setError("");
    try {
      const res = await fetch("/api/admin/enroll-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({
          alumno_id: enrollModal.target.id,
          carrera_id: enrollForm.carrera_id,
          ciclo: parseInt(enrollForm.ciclo),
          fecha_inicio_ciclo: enrollForm.fecha_inicio_ciclo || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      alert(json.message ?? "Inscripción creada exitosamente.");
      setEnrollModal({ show: false, target: null });
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setEnrollSaving(false);
    }
  }

  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const vals = line.split(",");
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i]?.trim() ?? ""; });
      return { nombre_completo: obj.nombre || obj.nombre_completo || "", email: obj.email || obj.correo || "", tipo: obj.tipo || obj.rol || "alumno", dni: obj.dni || "" };
    }).filter(r => r.email);

    if (!rows.length) { setError("CSV vacío o sin emails"); return; }

    try {
      const res = await fetch("/api/admin/import-users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      const ok = json.results?.filter((r: { status: string }) => r.status === "ok").length ?? 0;
      const err = json.results?.filter((r: { status: string }) => r.status === "error").length ?? 0;
      alert(`Importación: ${ok} exitosos, ${err} errores`);
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    if (csvRef.current) csvRef.current.value = "";
  }

  function exportCSV() {
    const csv = "nombre_completo,email,rol,estado,dni\n" +
      lista.map(p => `${p.nombre_completo},${p.email},${p.rol},${p.estado},${p.dni ?? ""}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "usuarios.csv"; a.click();
  }

  const lista = profiles
    .filter(p => filtroEstado === "todos" ? p.estado === "activo" : p.estado === filtroEstado)
    .filter(p => filtroRol === "todos" || p.rol === filtroRol)
    .filter(p => !search || p.nombre_completo.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 w-full space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Alumnos y Profesores</h1>
          <p className="text-mcm-muted text-sm">{profiles.length} registrados · {profiles.filter(p => p.estado === "activo").length} activos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <UserPlus size={14} /> Crear usuario
          </button>
          <button onClick={() => csvRef.current?.click()} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={14} /> Importar CSV
          </button>
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} /> Exportar
          </button>
          <button onClick={cargar} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mcm-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o email..."
            className="w-full pl-9 pr-3 py-2 border border-mcm-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526]" />
        </div>
        {["todos", "alumno", "profesor"].map(r => (
          <button key={r} onClick={() => setFiltroRol(r)}
            className={clsx("px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize",
              filtroRol === r ? "bg-[#a93526] text-white" : "bg-slate-100 text-mcm-muted hover:bg-slate-200")}>
            {r}
          </button>
        ))}
        <span className="text-mcm-border">|</span>
        {["todos", "activo", "inactivo"].map(e => (
          <button key={`e-${e}`} onClick={() => setFiltroEstado(e)}
            className={clsx("px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize",
              filtroEstado === e ? "bg-[#a93526] text-white" : "bg-slate-100 text-mcm-muted hover:bg-slate-200")}>
            {e === "todos" ? "todos los estados" : e}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted">
            <Loader2 size={20} className="animate-spin" /> <span className="text-sm">Cargando...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Nombre", "Email", "Rol", "DNI", "Estado", "Acciones"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(p => (
                  <tr key={p.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-mcm-text">{p.nombre_completo}</td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">{p.email}</td>
                    <td className="py-3 px-4"><span className={p.rol === "profesor" ? "badge-blue" : "badge-green"}>{p.rol}</span></td>
                    <td className="py-3 px-4 text-mcm-muted font-mono text-xs">{p.dni ?? "—"}</td>
                    <td className="py-3 px-4">
                      <span className={p.estado === "activo" ? "badge-green" : "px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600"}>{p.estado}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button onClick={() => handleReset(p.id)} title="Restablecer contraseña"
                          className="text-mcm-muted hover:text-[#a93526]"><Key size={14} /></button>
                        <button onClick={() => handleToggle(p.id, p.estado)} title={p.estado === "activo" ? "Desactivar" : "Activar"}
                          className="text-mcm-muted hover:text-[#a93526]">
                          {p.estado === "activo" ? <XCircle size={14} /> : <CheckCircle size={14} />}
                        </button>
                        {p.rol === "alumno" && (
                          <button onClick={() => openEnrollModal(p)} title="Asignar carrera/ciclo"
                            className="text-mcm-muted hover:text-blue-600"><GraduationCap size={14} /></button>
                        )}
                        {p.rol === "alumno" && (
                          <button onClick={() => router.push(`/dashboard/pagos-alumno?alumno_id=${p.id}&nombre=${encodeURIComponent(p.nombre_completo)}`)}
                            title="Gestionar pagos" className="text-mcm-muted hover:text-green-600"><CreditCard size={14} /></button>
                        )}
                        {p.id !== user?.id && (
                          <button onClick={() => handlePurge(p)} title="Eliminar usuario de prueba (irreversible)"
                            className="text-mcm-muted hover:text-red-700"><UserX size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-mcm-muted text-sm">Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear usuario */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">Crear usuario</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-mcm-muted" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Tipo</label>
                <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  <option value="alumno">Alumno</option>
                  <option value="profesor">Profesor</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Nombres *</label>
                  <input value={form.nombres} onChange={e => setForm({...form, nombres: e.target.value.toUpperCase()})}
                    placeholder="JUAN CARLOS" style={{ textTransform: "uppercase" }}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Apellidos *</label>
                  <input value={form.apellidos} onChange={e => setForm({...form, apellidos: e.target.value.toUpperCase()})}
                    placeholder="PÉREZ GARCÍA" style={{ textTransform: "uppercase" }}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Correo electrónico</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  placeholder="usuario@margaritacabrera.edu.pe"
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">DNI (opcional)</label>
                <input value={form.dni} onChange={e => setForm({...form, dni: e.target.value.replace(/\D/g,"").slice(0,8)})}
                  placeholder="12345678" maxLength={8}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
              </div>
              {/* Campos de carrera y ciclo — solo para alumnos */}
              {form.tipo === "alumno" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-mcm-text mb-1">Carrera *</label>
                      <select value={form.carrera_id} onChange={e => setForm({...form, carrera_id: e.target.value})}
                        className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                        <option value="">Seleccionar...</option>
                        {carrerasDisp.map(c => <option key={c.id} value={c.id}>{c.nombre_carrera}</option>)}
                      </select>
                      {!form.carrera_id && <p className="text-red-500 text-xs mt-1">Obligatorio para alumnos</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-mcm-text mb-1">Ciclo inicial *</label>
                      <select value={form.ciclo_inicial} onChange={e => setForm({...form, ciclo_inicial: e.target.value})}
                        className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                        {[1,2,3,4,5,6].map(n => <option key={n} value={String(n)}>Ciclo {n}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Fecha de inicio — solo para ciclo 1 */}
                  {form.ciclo_inicial === "1" && (
                    <div>
                      <label className="block text-sm font-medium text-mcm-text mb-1">Fecha de inicio de clases</label>
                      <input type="date" value={form.fecha_inicio_ciclo}
                        onChange={e => setForm({...form, fecha_inicio_ciclo: e.target.value})}
                        className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                      <p className="text-xs text-mcm-muted mt-1">
                        {form.fecha_inicio_ciclo
                          ? new Date(form.fecha_inicio_ciclo + "T00:00:00").getDay() === 1
                            ? "✓ Lunes confirmado"
                            : "⚠️ Se ajustará al próximo lunes"
                          : "Si no se indica, se usará el próximo lunes"}
                      </p>
                    </div>
                  )}
                </>
              )}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.auto_password}
                    onChange={e => setForm({...form, auto_password: e.target.checked})} className="accent-[#a93526]" />
                  Generar contraseña automática
                </label>
                {!form.auto_password && (
                  <input type="text" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                    placeholder="Contraseña (mín. 6 caracteres)"
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                )}
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.force_change}
                    onChange={e => setForm({...form, force_change: e.target.checked})} className="accent-[#a93526]" />
                  Forzar cambio de contraseña al primer ingreso
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.notify_email}
                    onChange={e => setForm({...form, notify_email: e.target.checked})} className="accent-[#a93526]" />
                  Notificar por email con credenciales
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={saving || !form.nombres || !form.apellidos || !form.email || (form.tipo === "alumno" && !form.carrera_id)}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Creando..." : "Crear usuario"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal asignar carrera/ciclo */}
      {enrollModal.show && enrollModal.target && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">Asignar Carrera y Ciclo</h3>
              <button onClick={() => setEnrollModal({ show: false, target: null })}><X size={20} className="text-mcm-muted" /></button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
              <p className="text-sm font-semibold text-blue-800">{enrollModal.target.nombre_completo}</p>
              <p className="text-xs text-blue-600">{enrollModal.target.email}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Carrera *</label>
                <select value={enrollForm.carrera_id} onChange={e => setEnrollForm({...enrollForm, carrera_id: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  <option value="">Seleccionar carrera...</option>
                  {carrerasDisp.map(c => <option key={c.id} value={c.id}>{c.nombre_carrera}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Ciclo *</label>
                <select value={enrollForm.ciclo} onChange={e => setEnrollForm({...enrollForm, ciclo: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  {[1,2,3,4,5,6].map(n => <option key={n} value={String(n)}>Ciclo {n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Fecha de inicio de clases</label>
                <input type="date" value={enrollForm.fecha_inicio_ciclo}
                  onChange={e => setEnrollForm({...enrollForm, fecha_inicio_ciclo: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                <p className="text-xs text-mcm-muted mt-1">
                  {enrollForm.fecha_inicio_ciclo
                    ? new Date(enrollForm.fecha_inicio_ciclo + "T00:00:00").getDay() === 1
                      ? "✓ Lunes confirmado"
                      : "⚠️ Se ajustará al próximo lunes"
                    : "Si no se indica, se usará el próximo lunes"}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEnrollModal({ show: false, target: null })} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleEnroll} disabled={enrollSaving || !enrollForm.carrera_id}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {enrollSaving && <Loader2 size={14} className="animate-spin" />}
                {enrollSaving ? "Asignando..." : "Asignar inscripción"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsuariosPage() {
  return (
    <RouteGuard allowedRoles={["super_admin"]}>
      <UsuariosContent />
    </RouteGuard>
  );
}
