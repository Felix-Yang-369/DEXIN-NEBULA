import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

const viewKeySchema = z.string().regex(/^[a-z][a-z0-9_.-]{2,79}$/);
const bodySchema = z.object({ name: z.string().trim().min(2).max(40), visibleColumns: z.array(z.string().min(1).max(80)).min(1).max(80) });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ viewKey: string }> }) {
  await requireCurrentEmployee();
  const parsedKey = viewKeySchema.safeParse((await params).viewKey);
  if (!parsedKey.success) return NextResponse.json({ ok: false, error: "invalid_view" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("business_saved_views").select("name, config, updated_at").eq("view_key", parsedKey.data).order("updated_at", { ascending: false }).limit(10);
  if (error) return NextResponse.json({ ok: false, error: "view_unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, views: data ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ viewKey: string }> }) {
  await requireCurrentEmployee();
  const parsedKey = viewKeySchema.safeParse((await params).viewKey);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedKey.success || !parsedBody.success) return NextResponse.json({ ok: false, error: "invalid_view" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_business_view", { p_view_key: parsedKey.data, p_name: parsedBody.data.name, p_config: { visibleColumns: parsedBody.data.visibleColumns } });
  if (error) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 403 });
  return NextResponse.json({ ok: true, id: data });
}
