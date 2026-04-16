import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { generatePassword } from "@/lib/password-utils";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: admin } } = await supabase.auth.getUser(token);
  if (!admin?.email || admin.email.toLowerCase() !== "admin@margaritacabrera.edu.pe") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { rows } = await req.json() as {
    rows: { nombre_completo: string; email: string; tipo: string; dni?: string }[];
  };

  if (!rows?.length) return NextResponse.json({ error: "Sin datos" }, { status: 400 });

  const results: { email: string; status: "ok" | "error"; message?: string }[] = [];

  for (const row of rows) {
    try {
      const password = generatePassword();
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: row.email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { full_name: row.nombre_completo.trim() },
      });

      if (error) { results.push({ email: row.email, status: "error", message: error.message }); continue; }

      await supabaseAdmin.from("profiles").upsert({
        id: data.user.id,
        nombre_completo: row.nombre_completo.trim(),
        rol: row.tipo === "profesor" ? "profesor" : "alumno",
        estado: "activo",
        dni: row.dni?.trim() || null,
        created_by: admin.id,
      });

      results.push({ email: row.email, status: "ok" });
    } catch (e) {
      results.push({ email: row.email, status: "error", message: e instanceof Error ? e.message : "Error" });
    }
  }

  await supabaseAdmin.from("historial_auditoria").insert({
    accion: "import_csv", admin_id: admin.id, admin_email: admin.email,
    detalle: { total: rows.length, ok: results.filter(r => r.status === "ok").length },
  });

  return NextResponse.json({ results });
}
