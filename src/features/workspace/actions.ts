"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

const modules=["sales","inventory","approvals","customers","products","finance","oa","system"] as const;
const widgets=["health","kpis","sales_trend","business_source","products","inventory","todos","quick_actions"] as const;

export async function saveWorkspacePreferencesAction(formData:FormData){
  await requireCurrentEmployee();
  const parsed=z.object({pinned:z.array(z.enum(modules)).max(8),hidden:z.array(z.enum(widgets)).max(12),density:z.enum(["comfortable","compact"]),defaultWorkspace:z.enum(["dashboard","sales","inventory","finance","oa"])}).safeParse({pinned:formData.getAll("pinned"),hidden:formData.getAll("hidden"),density:formData.get("density"),defaultWorkspace:formData.get("defaultWorkspace")});
  if(!parsed.success)redirect("/dashboard?workspace_error=invalid");
  const supabase=await createClient();
  const {error}=await supabase.rpc("save_workspace_preferences",{p_pinned_modules:parsed.data.pinned,p_hidden_widgets:parsed.data.hidden,p_density:parsed.data.density,p_default_workspace:parsed.data.defaultWorkspace});
  if(error)redirect("/dashboard?workspace_error=save_failed");
  revalidatePath("/dashboard"); redirect("/dashboard?workspace_saved=1");
}

export async function saveSidebarModeAction(mode: "expanded" | "compact") {
  await requireCurrentEmployee();
  const parsed = z.enum(["expanded", "compact"]).safeParse(mode);
  if (!parsed.success) return { ok: false as const };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_sidebar_mode", {
    p_sidebar_mode: parsed.data,
  });
  if (error) return { ok: false as const };

  revalidatePath("/", "layout");
  return { ok: true as const };
}
