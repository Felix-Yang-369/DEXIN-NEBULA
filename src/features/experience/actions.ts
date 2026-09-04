"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";
export async function saveFormDefinitionAction(fd: FormData) {
  await requireCurrentEmployee();
  let schema: unknown;
  try {
    schema = JSON.parse(String(fd.get("schema") ?? "[]"));
  } catch {
    redirect("/system/forms?error=invalid_schema");
  }
  const p = z
    .object({
      code: z.string().regex(/^[a-z][a-z0-9_]{2,39}$/),
      name: z.string().trim().min(2).max(80),
      description: z.string().trim().max(300),
      status: z.enum(["draft", "published"]),
      schema: z
        .array(
          z.object({
            key: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
            label: z.string().min(1).max(60),
            type: z.enum([
              "text",
              "number",
              "date",
              "select",
              "textarea",
              "checkbox",
            ]),
            required: z.boolean().optional(),
            options: z.array(z.string()).optional(),
          }),
        )
        .max(50),
    })
    .safeParse({
      code: fd.get("code"),
      name: fd.get("name"),
      description: fd.get("description") ?? "",
      status: fd.get("status"),
      schema,
    });
  if (!p.success) redirect("/system/forms?error=invalid_form");
  const s = await createClient();
  const { error } = await s.rpc("save_configurable_form", {
    p_form_id: null,
    p_code: p.data.code,
    p_name: p.data.name,
    p_description: p.data.description,
    p_field_schema: p.data.schema,
    p_status: p.data.status,
  });
  if (error) redirect("/system/forms?error=save_failed");
  revalidatePath("/system/forms");
  redirect("/system/forms?created=1");
}
export async function savePrintTemplateAction(fd: FormData) {
  await requireCurrentEmployee();
  const p = z
    .object({
      code: z.string().regex(/^[a-z][a-z0-9_]{2,39}$/),
      name: z.string().trim().min(2).max(80),
      type: z.enum([
        "quote",
        "sales_order",
        "purchase_order",
        "outbound",
        "statement",
        "voucher",
      ]),
      paper: z.enum(["A4", "A5", "label"]),
      orientation: z.enum(["portrait", "landscape"]),
      header: z.string().trim().max(200),
      footer: z.string().trim().max(200),
    })
    .safeParse({
      code: fd.get("code"),
      name: fd.get("name"),
      type: fd.get("documentType"),
      paper: fd.get("paperSize"),
      orientation: fd.get("orientation"),
      header: fd.get("header") ?? "",
      footer: fd.get("footer") ?? "",
    });
  if (!p.success) redirect("/system/print-templates?error=invalid_template");
  const s = await createClient();
  const { error } = await s.rpc("save_print_template", {
    p_id: null,
    p_code: p.data.code,
    p_name: p.data.name,
    p_document_type: p.data.type,
    p_paper_size: p.data.paper,
    p_orientation: p.data.orientation,
    p_header_text: p.data.header,
    p_footer_text: p.data.footer,
    p_show_logo: fd.get("showLogo") === "on",
    p_show_watermark: fd.get("showWatermark") === "on",
  });
  if (error) redirect("/system/print-templates?error=save_failed");
  revalidatePath("/system/print-templates");
  redirect("/system/print-templates?created=1");
}
export async function submitConfigurableFormAction(fd: FormData) {
  await requireCurrentEmployee();
  const formId = z.uuid().safeParse(fd.get("formId"));
  let payload: unknown;
  try {
    payload = JSON.parse(String(fd.get("payload") ?? "{}"));
  } catch {
    redirect("/forms?error=invalid_payload");
  }
  if (
    !formId.success ||
    !z.record(z.string(), z.unknown()).safeParse(payload).success
  )
    redirect("/forms?error=invalid_payload");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_configurable_form", {
    p_form_id: formId.data,
    p_payload: payload,
  });
  if (error) redirect(`/forms/${formId.data}?error=submit_failed`);
  revalidatePath("/forms");
  redirect(`/forms/${formId.data}?submitted=1`);
}
