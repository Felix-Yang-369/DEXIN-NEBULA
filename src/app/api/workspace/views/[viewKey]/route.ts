import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

const viewKeySchema = z.string().regex(/^[a-z][a-z0-9_.-]{2,79}$/);
const columnKeySchema = z.string().regex(/^[a-zA-Z0-9_.-]{1,80}$/);
const filterValueSchema = z.union([
  z.string().max(200),
  z.array(z.string().max(200)).max(20),
]);
const viewConfigSchema = z.object({
  visibleColumns: z.array(columnKeySchema).min(1).max(80),
  columnOrder: z.array(columnKeySchema).max(80).default([]),
  columnWidths: z.record(columnKeySchema, z.number().int().min(80).max(480)).default({}),
  stickyColumns: z.array(columnKeySchema).max(3).default([]),
  sort: z.object({ key: columnKeySchema, direction: z.enum(["asc", "desc"]) }).optional(),
  filters: z.record(z.string().max(80), filterValueSchema).default({}),
  pageSize: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
  density: z.literal("compact").default("compact"),
});
const saveBodySchema = z.object({
  name: z.string().trim().min(2).max(40),
  config: viewConfigSchema,
});
const renameBodySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(40),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ viewKey: string }> }) {
  await requireCurrentEmployee();
  const parsedKey = viewKeySchema.safeParse((await params).viewKey);
  if (!parsedKey.success) return NextResponse.json({ ok: false, error: "invalid_view" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("business_saved_views").select("id, name, config, updated_at").eq("view_key", parsedKey.data).order("updated_at", { ascending: false }).limit(10);
  if (error) return NextResponse.json({ ok: false, error: "view_unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, views: data ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ viewKey: string }> }) {
  await requireCurrentEmployee();
  const parsedKey = viewKeySchema.safeParse((await params).viewKey);
  const rawBody = await request.json().catch(() => null);
  const compatibleBody = rawBody && !rawBody.config && rawBody.visibleColumns
    ? {
        name: rawBody.name,
        config: {
          visibleColumns: rawBody.visibleColumns,
          columnOrder: rawBody.visibleColumns,
          columnWidths: {},
          stickyColumns: [],
          filters: {},
          pageSize: 20,
          density: "compact",
        },
      }
    : rawBody;
  const parsedBody = saveBodySchema.safeParse(compatibleBody);
  if (!parsedKey.success || !parsedBody.success) return NextResponse.json({ ok: false, error: "invalid_view" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_business_view", { p_view_key: parsedKey.data, p_name: parsedBody.data.name, p_config: parsedBody.data.config });
  if (error) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 403 });
  return NextResponse.json({ ok: true, id: data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ viewKey: string }> }) {
  await requireCurrentEmployee();
  const parsedKey = viewKeySchema.safeParse((await params).viewKey);
  const parsedBody = renameBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedKey.success || !parsedBody.success) return NextResponse.json({ ok: false, error: "invalid_view" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rename_business_view", {
    p_id: parsedBody.data.id,
    p_name: parsedBody.data.name,
    p_view_key: parsedKey.data,
  });
  if (error || !data) return NextResponse.json({ ok: false, error: "rename_failed" }, { status: 403 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ viewKey: string }> }) {
  await requireCurrentEmployee();
  const parsedKey = viewKeySchema.safeParse((await params).viewKey);
  const id = z.string().uuid().safeParse(request.nextUrl.searchParams.get("id"));
  if (!parsedKey.success || !id.success) return NextResponse.json({ ok: false, error: "invalid_view" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_business_view", {
    p_id: id.data,
    p_view_key: parsedKey.data,
  });
  if (error || !data) return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
