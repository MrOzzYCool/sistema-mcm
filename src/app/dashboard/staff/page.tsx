"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import RouteGuard from "@/components/RouteGuard";
import { supabase } from "@/lib/supabase";
import {
  UserPlus, RefreshCw, Loader2, Search, X, Pencil, Save,
  Key, Lock, XCircle, Trash2, Shield,
} from "lucide-react";
import clsx from "clsx";

const STAFF_ROLES = [
  "super_admin", "staff_tramites", "gestor", "actualizacion", "cycle_manager",
  "administradora", "secretaria_academica", "secretaria_atencion_academica", "coordinacion_academica",
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "SUPER ADMIN", staff_tramites: "STAFF TRÁMITES", gestor: "GESTOR",
  actualizacion: "ACTUALIZACIÓN", cycle_manager: "CYCLE MANAGER",
  administradora: "GERENTE GENERAL", secretaria_academica: "SECRETARÍA ACADÉMICA",
  secretaria_atencion_academica: "SECRETARÍA ATENCIÓN ACADÉMICA",
  coordinacion_academica: "COORDINACIÓN ACADÉMICA",
};

const ASSIGNABLE_ROLES = [
  { value: "administradora", label: "Gerente General" },
  { value: "secretaria_academica", label: "Secretaría Académica" },
  { value: "secretaria_atencion_academica", label: "Secretaría Atención Académica" },
  { value: "coordinacion_academica", label: "Coordinación Académica" },
];

interface StaffProfile {
  id: string; nombre_completo: string; email: string;
  rol: string; estado: string; dni: string | null; created_at: string;
  force_password_reset?: boolean;
}

function StaffContent() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    nombres: "", apellidos: "", email: "", dni: "", rol: "administradora",
    password: "", auto_password: true,
  });
  const [editTarget, setEditTarget] = useState<StaffProfile | null>(null);
  const [editForm, setEditForm] = useState({ nombre_completo: "", rol: "", estado: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [setPwTarget, setSetPwTarget] = useState<StaffProfile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

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
      setStaff(data.filter((p: StaffProfile) => STAFF_ROLES.includes(p.rol)));
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function staffAction(action: string, staffId: string, extra?: Record<string, unknown>) {
    const res = await fetch("/api/admin/staff-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
      body: JSON.stringify({ action, staffId, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json;
  }

  async function handleCreate() {
    setSaving(true); setError(""); setSuccess("");
    try {
      const nombre_completo = `${createForm.nombres.trim()} ${createForm.apellidos.trim()}`.trim();
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({
          tipo: createForm.rol, nombre_completo, email: createForm.email,
          dni: createForm.dni, password: createForm.password,
          auto_password: createForm.auto_password, force_change: true, notify_email: true,
        }),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(json.error);
      setSuccess(`Personal "${nombre_completo}" creado.`);
      setShowCreate(false);
      setCreateForm({ nombres: "", apellidos: "", email: "", dni: "", rol: "administradora", password: "", auto_password: true });
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  async function handleResetPw(p: StaffProfile) {
    if (!confirm(`¿Resetear contraseña de ${p.nombre_completo}?\nSe enviará una contraseña temporal a ${p.email}.`)) return;
    setError(""); setSuccess("");
    try {
      const json = await staffAction("reset-password", p.id);
      setSuccess(json.message);
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }

  async function handleSetPw() {
    if (!setPwTarget || !newPassword) return;
    setPwSaving(true); setError("");
    try {
      const json = await staffAction("set-password", setPwTarget.id, { password: newPassword });
      setSuccess(json.message);
      setSetPwTarget(null); setNewPassword("");
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setPwSaving(false); }
  }

  async function handleDeactivate(p: StaffProfile) {
    if (!confirm(`¿Desactivar a ${p.nombre_completo}?`)) return;
    try {
      const json = await staffAction("deactivate", p.id);
      setSuccess(json.message); cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }

  async function handlePermanentDelete(p: StaffProfile) {
    if (!confirm(`⚠️ ELIMINAR PERMANENTEMENTE a ${p.nombre_completo}?\n\nEsta acción es IRREVERSIBLE.`)) return;
    if (!confirm(`¿Estás SEGURO? Se eliminará de Auth y de profiles.`)) return;
    try {
      const json = await staffAction("permanent-delete", p.id);
      setSuccess(json.message); cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }

  async function handleToggleForceReset(p: StaffProfile) {
    try {
      await staffAction("toggle-force-reset", p.id, { value: !p.force_password_reset });
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
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
      if (editForm.estado !== editTarget.estado) {
        await fetch("/api/admin/toggle-user", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: editTarget.id, estado: editForm.estado }),
        });
      }
      await fetch("/api/admin/staff-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: editTarget.id, nombre_completo: editForm.nombre_completo, rol: editForm.rol }),
      });
      setEditTarget(null); setSuccess("Personal actualizado."); cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setEditSaving(false); }
  }

  const lista = staff.filter(p => !search || p.nombre_completo.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 w-full space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mcm-text">Gestión de Staff</h1>
          <p className="text-mcm-muted text-sm">{staff.length} trabajadores</p>
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

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mcm-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
          className="w-full pl-9 pr-3 py-2 border border-mcm-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a93526]" />
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-mcm-muted"><Loader2 size={20} className="animate-spin" /> Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Nombre", "Email", "Cargo", "Estado", "Acciones"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-mcm-muted font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(p => (
                  <tr key={p.id} className="border-t border-mcm-border hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-mcm-text">{p.nombre_completo}</div>
                      {p.force_password_reset && (
                        <span className="badge-yellow text-xs mt-0.5 inline-flex items-center gap-1"><Shield size={10} /> Cambio pendiente</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-mcm-muted text-xs">{p.email}</td>
                    <td className="py-3 px-4">
                      <span className="badge-blue text-xs font-bold">{ROLE_LABELS[p.rol] ?? p.rol.toUpperCase()}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={p.estado === "activo" ? "badge-green" : "px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600"}>{p.estado}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(p)} title="Editar" className="text-mcm-muted hover:text-[#a93526]"><Pencil size={14} /></button>
                        <button onClick={() => handleResetPw(p)} title="Reset contraseña" className="text-mcm-muted hover:text-amber-600"><Key size={14} /></button>
                        <button onClick={() => { setSetPwTarget(p); setNewPassword(""); }} title="Asignar contraseña" className="text-mcm-muted hover:text-blue-600"><Lock size={14} /></button>
                        <button onClick={() => handleToggleForceReset(p)} title={p.force_password_reset ? "Quitar forzar cambio" : "Forzar cambio"}
                          className={p.force_password_reset ? "text-amber-500 hover:text-amber-700" : "text-mcm-muted hover:text-amber-500"}><Shield size={14} /></button>
                        {p.estado === "activo" && p.id !== user?.id && (
                          <button onClick={() => handleDeactivate(p)} title="Desactivar" className="text-mcm-muted hover:text-red-500"><XCircle size={14} /></button>
                        )}
                        {p.id !== user?.id && (
                          <button onClick={() => handlePermanentDelete(p)} title="Eliminar permanentemente" className="text-mcm-muted hover:text-red-700"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!lista.length && <tr><td colSpan={5} className="py-12 text-center text-mcm-muted text-sm">Sin resultados</td></tr>}
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
                    style={{ textTransform: "uppercase" }}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-mcm-text mb-1">Apellidos *</label>
                  <input value={createForm.apellidos} onChange={e => setCreateForm({...createForm, apellidos: e.target.value.toUpperCase()})}
                    style={{ textTransform: "uppercase" }}
                    className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Email *</label>
                <input type="email" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">DNI</label>
                <input value={createForm.dni} onChange={e => setCreateForm({...createForm, dni: e.target.value.replace(/\D/g,"").slice(0,8)})}
                  maxLength={8} className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Cargo *</label>
                <select value={createForm.rol} onChange={e => setCreateForm({...createForm, rol: e.target.value})}
                  className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]">
                  {ASSIGNABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={createForm.auto_password}
                  onChange={e => setCreateForm({...createForm, auto_password: e.target.checked})} className="accent-[#a93526]" />
                Generar contraseña automática
              </label>
              {!createForm.auto_password && (
                <input value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})}
                  placeholder="Contraseña (mín. 6)" className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={saving || !createForm.nombres || !createForm.apellidos || !createForm.email}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} {saving ? "Creando..." : "Crear"}
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
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-800 font-semibold">{editTarget.email}</div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-mcm-text mb-1">Nombre</label>
                <input value={editForm.nombre_completo} onChange={e => setEditForm({...editForm, nombre_completo: e.target.value.toUpperCase()})}
                  style={{ textTransform: "uppercase" }} className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
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
                {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {editSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set password modal */}
      {setPwTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-mcm-text text-lg">Asignar Contraseña</h3>
              <button onClick={() => setSetPwTarget(null)}><X size={20} className="text-mcm-muted" /></button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-800">{setPwTarget.nombre_completo}</div>
            <div>
              <label className="block text-sm font-medium text-mcm-text mb-1">Nueva contraseña</label>
              <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full border border-mcm-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a93526]" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setSetPwTarget(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleSetPw} disabled={pwSaving || newPassword.length < 6}
                className="btn-primary flex-1 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {pwSaving && <Loader2 size={14} className="animate-spin" />} {pwSaving ? "Guardando..." : "Asignar"}
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
