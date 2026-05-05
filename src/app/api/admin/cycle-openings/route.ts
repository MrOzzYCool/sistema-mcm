import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const ALLOWED_ROLES = ["super_admin", "cycle_manager"];

async function verifyAccess(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  // Check hardcoded admin
  if (user.email?.toLowerCase() === "admin@margaritacabrera.edu.pe") return user;

  // Check profile role
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.rol)) return null;
  return user;
}

/**
 * GET /api/admin/cycle-openings
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAccess(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("cycle_openings")
    .select("*")
    .order("cycle_number", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ openings: data ?? [] });
}

/**
 * POST /api/admin/cycle-openings
 * Body: { cycle_number, start_date }
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAccess(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { cycle_number, start_date, fecha_fin } = await req.json();

  if (!cycle_number || !start_date) {
    return NextResponse.json({ error: "cycle_number y start_date son requeridos" }, { status: 400 });
  }

  if (!Number.isInteger(cycle_number) || cycle_number <= 0) {
    return NextResponse.json({ error: "cycle_number debe ser un entero positivo" }, { status: 400 });
  }

  // Check if there's already an active opening for this cycle
  const { data: existing } = await supabaseAdmin
    .from("cycle_openings")
    .select("id")
    .eq("cycle_number", cycle_number)
    .eq("status", "activo")
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: `Ya existe una apertura activa para el ciclo ${cycle_number}` }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from("cycle_openings")
    .insert({ cycle_number, start_date, fecha_fin: fecha_fin || null, status: "activo", created_by: admin.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("historial_auditoria").insert({
    accion: "aperturar_ciclo",
    admin_id: admin.id, admin_email: admin.email,
    detalle: { cycle_number, start_date },
  });

  return NextResponse.json({ success: true, opening: data }, { status: 201 });
}

/**
 * PUT /api/admin/cycle-openings
 * Body: { id, cycle_number?, start_date?, fecha_fin?, status? }
 */
export async function PUT(req: NextRequest) {
  const admin = await verifyAccess(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id, cycle_number, start_date, fecha_fin, status } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const updateData: Record<string, unknown> = {};
  if (cycle_number !== undefined) updateData.cycle_number = cycle_number;
  if (start_date !== undefined) updateData.start_date = start_date;
  if (fecha_fin !== undefined) updateData.fecha_fin = fecha_fin;
  if (status !== undefined) updateData.status = status;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("cycle_openings")
    .update(updateData)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("historial_auditoria").insert({
    accion: "editar_apertura_ciclo",
    admin_id: admin.id, admin_email: admin.email,
    detalle: { opening_id: id, ...updateData },
  });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/admin/cycle-openings
 * Body: { id }
 * Solo super_admin puede eliminar
 */
export async function DELETE(req: NextRequest) {
  const admin = await verifyAccess(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  // Verificar que sea super_admin
  const isSuperAdmin = admin.email?.toLowerCase() === "admin@margaritacabrera.edu.pe";
  if (!isSuperAdmin) {
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("rol").eq("id", admin.id).single();
    if (!profile || profile.rol !== "super_admin") {
      return NextResponse.json({ error: "Solo super_admin puede eliminar aperturas" }, { status: 403 });
    }
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("cycle_openings")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("historial_auditoria").insert({
    accion: "eliminar_apertura_ciclo",
    admin_id: admin.id, admin_email: admin.email,
    detalle: { opening_id: id },
  });

  return NextResponse.json({ success: true });
}
