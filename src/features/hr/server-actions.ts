"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

const optionalUuid = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.uuid().nullable(),
);

function hrOrganizationRedirect(params: Record<string, string>): never {
  redirect(`/hr/job-structure?${new URLSearchParams(params).toString()}`);
}

export async function saveJobLevelAction(formData: FormData) {
  const employee = await requireCurrentEmployee();
  if (!employee.roleCodes.includes("hr")) {
    hrOrganizationRedirect({ error: "forbidden" });
  }

  const schema = z.object({
    code: z.string().trim().min(1).max(20),
    name: z.string().trim().min(2).max(50),
    rank: z.coerce.number().int().min(1).max(100),
    description: z.string().trim().max(300),
  });
  const parsed = schema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    rank: formData.get("rank"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) hrOrganizationRedirect({ error: "invalid_level" });

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_job_level", {
    p_level_id: null,
    p_code: parsed.data.code,
    p_name: parsed.data.name,
    p_rank: parsed.data.rank,
    p_description: parsed.data.description || null,
    p_status: "active",
  });
  if (error) {
    hrOrganizationRedirect({
      error: error.message.includes("已存在") ? "duplicate_level" : "failed",
    });
  }

  revalidatePath("/hr");
  revalidatePath("/hr/job-structure");
  hrOrganizationRedirect({ levelSaved: "1" });
}

export async function savePositionAction(formData: FormData) {
  const employee = await requireCurrentEmployee();
  if (!employee.roleCodes.includes("hr")) {
    hrOrganizationRedirect({ error: "forbidden" });
  }

  const schema = z.object({
    departmentId: optionalUuid,
    code: z.string().trim().min(2).max(30),
    name: z.string().trim().min(2).max(80),
    jobLevelId: optionalUuid,
    headcount: z.preprocess(
      (value) => (value === "" || value === null ? null : Number(value)),
      z.number().int().min(0).max(10000).nullable(),
    ),
    responsibilities: z.string().trim().max(1000),
  });
  const parsed = schema.safeParse({
    departmentId: formData.get("departmentId"),
    code: formData.get("code"),
    name: formData.get("name"),
    jobLevelId: formData.get("jobLevelId"),
    headcount: formData.get("headcount"),
    responsibilities: formData.get("responsibilities") ?? "",
  });
  if (!parsed.success) hrOrganizationRedirect({ error: "invalid_position" });

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_position", {
    p_position_id: null,
    p_department_id: parsed.data.departmentId,
    p_code: parsed.data.code,
    p_name: parsed.data.name,
    p_default_job_level_id: parsed.data.jobLevelId,
    p_headcount: parsed.data.headcount,
    p_responsibilities: parsed.data.responsibilities || null,
    p_status: "active",
  });
  if (error) {
    hrOrganizationRedirect({
      error: error.message.includes("已存在") ? "duplicate_position" : "failed",
    });
  }

  revalidatePath("/hr");
  revalidatePath("/hr/job-structure");
  hrOrganizationRedirect({ positionSaved: "1" });
}
