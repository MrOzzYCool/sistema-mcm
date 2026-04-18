import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: plans } = await supabaseAdmin
    .from("payment_plans")
    .select("*, installments(*)")
    .eq("alumno_id", user.id)
    .eq("status", "activo")
    .order("year", { ascending: false });

  return NextResponse.json({ plans: plans ?? [] });
}
