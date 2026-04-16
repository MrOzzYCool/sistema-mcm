"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import RouteGuard from "@/components/RouteGuard";
import { supabase } from "@/lib/supabase";
import {
  UserPlus, RefreshCw, Loader2, Search, Download, Upload,
  CheckCircle, XCircle, Key, Mail, Eye, X,
} from "lucide-react";
import clsx from "clsx";

interface Profile {
  id: string; nombre_completo: string; email: string;
  rol: string; estado: string; dni: string | null; created_at: string;
}

function UsuariosContent() {
  const { user } = useAuth();
  const [profiles, setProfiles]   = useState<Profile[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [filtroRol, setFiltroRol] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({
    tipo: "alumno", nombre_completo: "", email: "", dni: "",
    password: "", auto_password: true, force_change: true, notify_email: true,
  });

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
      setProfiles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleCreate() {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      console.log("Respuesta del servidor:", json);
      if (!res.ok && res.status !== 207) throw new Error(json.error);
      if (res.status === 207) {
        setError(`⚠️ Usuario creado en Auth pero NO en profiles: ${json.error}. Verifica permisos de la tabla profiles.`);
      }
      setShowModal(false);
      setForm({ tipo: "alumno", nombre_completo: "", email: "", dni: "", password: "", auto_password: true, force_change: true, notify_email: true });
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
    .filter(p => filtroRol === "todos" || p.rol === filtroRol)
    .filter(p => !search || p.nombre_completo.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 w-full space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Gestión de Usuarios</h1>
          <p className="text-mcm-muted text-sm">{profiles.length} usuarios registrados</p>
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
                      <span className={p.estado === "activo" ? "badge-green" : "badge-red"}>{p.estado}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button onClick={() => handleReset(p.id)} title="Resetear contraseña"
                          className="text-mcm-muted hover:text-[#a93526]"><Key size={14} /></button>
                        <button onClick={() => handleToggle(p.id, p.estado)} title={p.estado === "activo" ? "Desactivar" : "Activar"}
                          className="text-mcm-muted hover:text-[#a93526]">
                          {p.estado === "activo" ? <XCircle size={14} /> : <CheckCircle size={14} />}
                        </button>
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
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Nombre completo</label>
                <input value={form.nombre_completo} onChange={e => setForm({...form, nombre_completo: e.target.value.toUpperCase()})}
                  placeholder="NOMBRE APELLIDO" style={{ textTransform: "uppercase" }}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
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
              <button onClick={handleCreate} disabled={saving || !form.nombre_completo || !form.email}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Creando..." : "Crear usuario"}
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
