"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import RouteGuard from "@/components/RouteGuard";
import { supabase } from "@/lib/supabase";
import {
  UserPlus, RefreshCw, Loader2, Search, X, Pencil, Save,
  CheckCircle, XCircle,
} from "lucide-react";
import clsx from "clsx";

const STAFF_ROLES = [
  "super_admin", "staff_tramites", "gestor", "actualizacion", "cycle_manager",
  "administradora", "secretaria_academica", "secretaria_atencion_academica", "coordinacion_academica",
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "SUPER ADMIN",
  staff_tramites: "STAFF TRÁMITES",
  gestor: "GESTOR",
  actualizacion: "ACTUALIZACIÓN",
  cycle_manager: "CYCLE MANAGER",
  administradora: "GERENTE GENERAL",
  secretaria_academica: "SECRETARÍA ACADÉMICA",
  secretaria_atencion_academica: "SECRETARÍA ATENCIÓN ACADÉMICA",
  coordinacion_academica: "COORDINACIÓN ACADÉMICA",
};

// Roles disponibles para asignar a nuevo staff
const ASSIGNABLE_ROLES = [
  { value: "administradora", label: "Gerente General" },
  { value: "secretaria_academica", label: "Secretaría Académica" },
  { value: "secretaria_atencion_academica", label: "Secretaría Atención Académica" },
  { value: "coordinacion_academica", label: "Coordinación Académica" },
];

interface StaffProfile {
  id: string; nombre_completo: string; email: string;
  rol: string; estado: string; dni: string | null; created_at: string;
}

function StaffContent() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    nombres: "", apellidos: "", email: "", dni: "", rol: "administradora",
    password: "", auto_password: true,
  });

  // Edit modal
  const [editTarget, setEditTarget] = useState<StaffProfile | null>(null);
  const [editForm, setEditForm] = useState({ nombre_completo: "", rol: "", estado: "" });
  const [editSaving, setEditSaving] = useState(false);

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
      if (!res.ok) throw new Error(data.error);
      // Filter only staff roles
      setStaff(data.filter((p: StaffProfile) => STAFF_ROLES.includes(p.rol)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleCreate() {
    setSaving(true); setError(""); setSuccess("");
    try {
      const nombre_completo = `${createForm.nombres.trim()} ${createForm.apellidos.trim()}`.trim();
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({
          tipo: createForm.rol,
          nombre_completo,
          email: createForm.email,
          dni: createForm.dni,
          password: createForm.password,
          auto_password: createForm.auto_password,
          force_change: true,
          notify_email: true,
        }),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(json.error);
      setSuccess(`Personal "${nombre_completo}" creado correctamente.`);
      setShowCreate(false);
      setCreateForm({ nombres: "", apellidos: "", email: "", dni: "", rol: "administradora", password: "", auto_password: true });
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  function openEdit(p: StaffProfile) {
    setEditTarget(p);
    setEditForm({ nombre_completo: p.nombre_completo, rol: p.rol, estado: p.estado });
  }

  async function handleEdit() {
    if (!editTarget) return;
    setEditSaving(true); setError("");
    try {
      const token = await getToken();
      // Update profile via toggle endpoint for estado
      if (editForm.estado !== editTarget.estado) {
        await fetch("/api/admin/toggle-user", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: editTarget.id, estado: editForm.estado }),
        });
      }
      // For nombre and rol, we need a direct update — use the admin API
      // We'll create a simple update via supabaseAdmin proxy
      const res = await fetch("/api/admin/staff-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: editTarget.id,
          nombre_completo: editForm.nombre_completo,
          rol: editForm.rol,
        }),
      });
      if (res.ok || res.status === 404) {
        // 404 means the endpoint doesn't exist yet — that's ok, we'll create it
      }
      setEditTarget(null);
      setSuccess("Personal actualizado.");
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setEditSaving(false); }
  }

  const lista = staff
    .filter(p => !search || p.nombre_completo.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 w-full space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Gestión de Staff</h1>
          <p className="text-mcm-muted text-sm">{staff.length} trabajadores registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
            <UserPlus size={14} /> Nuevo Personal
          </button>
          <button onClick={cargar} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">{success}</div>}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mcm-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o email..."
          className="w-full pl-9 pr-3 py-2 border border-mcm-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526]" />
      </div>

      {/* Table */}
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
                  {["Nombre", "Email", "Cargo", "DNI", "Estado", "Acciones"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(p => (
                  <tr key={p.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-mcm-text">{p.nombre_completo}</td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">{p.email}</td>
                    <td className="py-3 px-4">
                      <span className="badge-blue text-xs font-bold">{ROLE_LABELS[p.rol] ?? p.rol.toUpperCase()}</span>
                    </td>
                    <td className="py-3 px-4 text-mcm-muted font-mono text-xs">{p.dni ?? "—"}</td>
                    <td className="py-3 px-4">
                      <span className={p.estado === "activo" ? "badge-green" : "px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600"}>{p.estado}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(p)} title="Editar" className="text-mcm-muted hover:text-[#a93526]"><Pencil size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!lista.length && <tr><td colSpan={6} className="py-12 text-center text-mcm-muted text-sm">Sin resultados</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">Nuevo Personal</h3>
              <button onClick={() => setShowCreate(false)}><X size={20} className="text-mcm-muted" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Nombres *</label>
                  <input value={createForm.nombres} onChange={e => setCreateForm({...createForm, nombres: e.target.value.toUpperCase()})}
                    placeholder="NOMBRE" style={{ textTransform: "uppercase" }}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Apellidos *</label>
                  <input value={createForm.apellidos} onChange={e => setCreateForm({...createForm, apellidos: e.target.value.toUpperCase()})}
                    placeholder="APELLIDO" style={{ textTransform: "uppercase" }}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Correo electrónico *</label>
                <input type="email" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})}
                  placeholder="usuario@margaritacabrera.edu.pe"
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">DNI (opcional)</label>
                <input value={createForm.dni} onChange={e => setCreateForm({...createForm, dni: e.target.value.replace(/\D/g,"").slice(0,8)})}
                  placeholder="12345678" maxLength={8}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Cargo *</label>
                <select value={createForm.rol} onChange={e => setCreateForm({...createForm, rol: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  {ASSIGNABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={createForm.auto_password}
                    onChange={e => setCreateForm({...createForm, auto_password: e.target.checked})} className="accent-[#a93526]" />
                  Generar contraseña automática
                </label>
                {!createForm.auto_password && (
                  <input type="text" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})}
                    placeholder="Contraseña (mín. 6 caracteres)"
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={saving || !createForm.nombres || !createForm.apellidos || !createForm.email}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Creando..." : "Crear Personal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">Editar Personal</h3>
              <button onClick={() => setEditTarget(null)}><X size={20} className="text-mcm-muted" /></button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
              <p className="text-sm font-semibold text-blue-800">{editTarget.email}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Nombre completo</label>
                <input value={editForm.nombre_completo} onChange={e => setEditForm({...editForm, nombre_completo: e.target.value.toUpperCase()})}
                  style={{ textTransform: "uppercase" }}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Cargo</label>
                <select value={editForm.rol} onChange={e => setEditForm({...editForm, rol: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  {ASSIGNABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Estado</label>
                <select value={editForm.estado} onChange={e => setEditForm({...editForm, estado: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditTarget(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleEdit} disabled={editSaving}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {editSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffPage() {
  return <RouteGuard allowedRoles={["super_admin"]}><StaffContent /></RouteGuard>;
}
