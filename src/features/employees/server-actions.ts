"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  assignableRoleCodes,
  normalizeEmployeeRoleCodes,
} from "@/features/permissions/employee-role-assignment";
import { createClient } from "@/lib/supabase/server";

const nullableUuid = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.uuid().nullable(),
);

const employeeSchema = z.object({
  employeeId: nullableUuid,
  departmentId: nullableUuid,
  managerId: nullableUuid,
  employeeNo: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(50),
  englishName: z.string().trim().max(80),
  email: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.email().transform((value) => value.toLowerCase()).nullable(),
  ),
  title: z.string().trim().max(80),
  hiredOn: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.iso.date().nullable(),
  ),
  status: z.enum(["active", "departed", "probation", "intern", "part_time"]),
});

function errorCode(message?: string) {
  if (message?.includes("只有系统管理员或董事长")) return "forbidden";
  if (message?.includes("只有系统管理员可以分配角色")) return "forbidden";
  if (message?.includes("只有人事或管理员")) return "forbidden";
  if (message?.includes("员工编号或邮箱已存在")) return "duplicate";
  if (message?.includes("直属负责人")) return "manager";
  if (message?.includes("当前登录账号")) return "self_protection";
  if (message?.includes("设置企业邮箱")) return "employee_email_missing";
  if (message?.includes("Auth 邮箱")) return "auth_email";
  if (message?.includes("Auth 用户不存在")) return "auth_missing";
  if (message?.includes("管理员角色")) return "admin_protection";
  if (message?.includes("最后一位系统管理员")) return "last_admin";
  if (message?.includes("最后一位董事长")) return "governance_protection";
  if (message?.includes("高危角色变更")) return "high_risk_confirmation";
  if (message?.includes("只有人事或管理员")) return "forbidden";
  if (message?.includes("员工异动参数")) return "invalid_employee_change";
  if (message?.includes("假期账户参数")) return "invalid_leave_balance";
  if (message?.includes("员工合同参数")) return "invalid_contract";
  if (message?.includes("转正日期")) return "invalid_hr_profile";
  return "operation_failed";
}

export async function saveEmployeeAction(formData: FormData) {
  await requireCurrentEmployee();

  const parsed = employeeSchema.safeParse({
    employeeId: formData.get("employeeId"),
    departmentId: formData.get("departmentId"),
    managerId: formData.get("managerId"),
    employeeNo: formData.get("employeeNo"),
    name: formData.get("name"),
    englishName: formData.get("englishName") ?? "",
    email: formData.get("email"),
    title: formData.get("title") ?? "",
    hiredOn: formData.get("hiredOn"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    redirect("/employees?error=invalid_employee");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("manage_employee_profile", {
    p_employee_id: parsed.data.employeeId,
    p_department_id: parsed.data.departmentId,
    p_manager_id: parsed.data.managerId,
    p_employee_no: parsed.data.employeeNo,
    p_name: parsed.data.name,
    p_english_name: parsed.data.englishName,
    p_email: parsed.data.email,
    p_title: parsed.data.title,
    p_hired_on: parsed.data.hiredOn,
    p_status: parsed.data.status,
  });

  if (error) {
    redirect(`/employees?error=${errorCode(error.message)}`);
  }

  revalidatePath("/employees");
  revalidatePath("/organization");
  redirect("/employees?saved=1");
}

const rolesSchema = z.object({
  employeeId: z.uuid(),
  roleCodes: z
    .array(z.enum(assignableRoleCodes))
    .min(1),
  highRiskConfirmation: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().trim().max(50),
  ),
  returnTo: z.enum(["employees", "roles"]).default("employees"),
});

export async function saveEmployeeRolesAction(formData: FormData) {
  await requireCurrentEmployee();

  const parsed = rolesSchema.safeParse({
    employeeId: formData.get("employeeId"),
    roleCodes: formData.getAll("roleCodes"),
    highRiskConfirmation: formData.get("highRiskConfirmation"),
    returnTo: formData.get("returnTo") ?? "employees",
  });

  if (!parsed.success) {
    const returnTo = formData.get("returnTo") === "roles" ? "roles" : "employees";
    redirect(
      returnTo === "roles"
        ? "/roles?rolesError=invalid_roles#employee-permissions"
        : "/employees?error=invalid_roles",
    );
  }

  const normalizedRoleCodes = normalizeEmployeeRoleCodes(parsed.data.roleCodes);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_employee_roles", {
    p_employee_id: parsed.data.employeeId,
    p_role_codes: normalizedRoleCodes,
    p_high_risk_confirmation: parsed.data.highRiskConfirmation,
  });

  if (error) {
    const code = errorCode(error.message);
    redirect(
      parsed.data.returnTo === "roles"
        ? `/roles?rolesError=${code}#employee-permissions`
        : `/employees?error=${code}`,
    );
  }

  revalidatePath("/employees");
  revalidatePath("/roles");
  revalidatePath("/system");
  redirect(
    parsed.data.returnTo === "roles"
      ? "/roles?rolesSaved=1#employee-permissions"
      : "/employees?rolesSaved=1",
  );
}

const accountSchema = z.object({
  employeeId: z.uuid(),
  authUserId: z.uuid(),
});

export async function linkEmployeeAccountAction(formData: FormData) {
  await requireCurrentEmployee();

  const parsed = accountSchema.safeParse({
    employeeId: formData.get("employeeId"),
    authUserId: formData.get("authUserId"),
  });

  if (!parsed.success) {
    redirect("/employees?error=invalid_auth_user");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("link_employee_auth_user", {
    p_employee_id: parsed.data.employeeId,
    p_auth_user_id: parsed.data.authUserId,
  });

  if (error) {
    redirect(`/employees?error=${errorCode(error.message)}`);
  }

  revalidatePath("/employees");
  redirect("/employees?accountLinked=1");
}

const avatarMimeTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export async function uploadEmployeeAvatarAction(formData: FormData) {
  await requireCurrentEmployee();
  const employeeId = String(formData.get("employeeId") ?? "");
  const file = formData.get("avatar");

  if (
    !z.uuid().safeParse(employeeId).success ||
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 2 * 1024 * 1024 ||
    !(file.type in avatarMimeTypes)
  ) {
    redirect("/employees?error=invalid_avatar");
  }

  const supabase = await createClient();
  const { data: employee } = await supabase
    .from("employees")
    .select("employee_no")
    .eq("id", employeeId)
    .maybeSingle();

  if (!employee) {
    redirect("/employees?error=invalid_employee");
  }

  const extension =
    avatarMimeTypes[file.type as keyof typeof avatarMimeTypes];
  const avatarPath = `dexin-miaosheng/${employee.employee_no}/avatar.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(avatarPath, file, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    redirect("/employees?error=avatar_upload_failed");
  }

  const { error: profileError } = await supabase.rpc("set_employee_avatar", {
    p_employee_id: employeeId,
    p_avatar_path: avatarPath,
  });

  if (profileError) {
    await supabase.storage.from("avatars").remove([avatarPath]);
    redirect("/employees?error=avatar_upload_failed");
  }

  revalidatePath("/employees");
  revalidatePath("/organization");
  revalidatePath("/dashboard");
  redirect("/employees?avatarSaved=1");
}

export async function uploadOwnAvatarAction(formData: FormData) {
  const employee = await requireCurrentEmployee();
  const file = formData.get("avatar");

  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 2 * 1024 * 1024 ||
    !(file.type in avatarMimeTypes)
  ) {
    redirect("/account?error=invalid_avatar");
  }

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", employee.organizationId)
    .maybeSingle();

  if (!organization?.slug) {
    redirect("/account?error=avatar_upload_failed");
  }

  const extension =
    avatarMimeTypes[file.type as keyof typeof avatarMimeTypes];
  const avatarPath = `${organization.slug}/${employee.employeeNo}/avatar.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(avatarPath, file, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("uploadOwnAvatar storage failed", uploadError.message);
    redirect("/account?error=avatar_upload_failed");
  }

  const { error: profileError } = await supabase.rpc("set_employee_avatar", {
    p_employee_id: employee.id,
    p_avatar_path: avatarPath,
  });

  if (profileError) {
    console.error("uploadOwnAvatar profile failed", profileError.code);
    if (employee.avatarPath !== avatarPath) {
      await supabase.storage.from("avatars").remove([avatarPath]);
    }
    redirect("/account?error=avatar_upload_failed");
  }

  if (employee.avatarPath && employee.avatarPath !== avatarPath) {
    await supabase.storage.from("avatars").remove([employee.avatarPath]);
  }

  revalidatePath("/account");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
  revalidatePath("/organization");
  redirect("/account?avatarSaved=1");
}

function employeeDetailRedirect(
  employeeId: string,
  params: Record<string, string>,
): never {
  const query = new URLSearchParams(params);
  redirect(`/employees/${employeeId}?${query.toString()}`);
}

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.iso.date().nullable(),
);

export async function saveEmployeeHrProfileAction(formData: FormData) {
  await requireCurrentEmployee();
  const schema = z.object({
    employeeId: z.uuid(),
    workLocation: z.string().trim().max(100),
    probationEndOn: optionalDate,
    regularizedOn: optionalDate,
    departureOn: optionalDate,
    personnelNote: z.string().trim().max(1000),
  });
  const parsed = schema.safeParse({
    employeeId: formData.get("employeeId"),
    workLocation: formData.get("workLocation") ?? "",
    probationEndOn: formData.get("probationEndOn"),
    regularizedOn: formData.get("regularizedOn"),
    departureOn: formData.get("departureOn"),
    personnelNote: formData.get("personnelNote") ?? "",
  });

  if (!parsed.success) {
    redirect("/employees?error=invalid_hr_profile");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_employee_hr_profile", {
    p_employee_id: parsed.data.employeeId,
    p_work_location: parsed.data.workLocation || null,
    p_probation_end_on: parsed.data.probationEndOn,
    p_regularized_on: parsed.data.regularizedOn,
    p_departure_on: parsed.data.departureOn,
    p_personnel_note: parsed.data.personnelNote || null,
  });

  if (error) {
    employeeDetailRedirect(parsed.data.employeeId, {
      error: errorCode(error.message),
    });
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  employeeDetailRedirect(parsed.data.employeeId, { profileSaved: "1" });
}

export async function createEmployeeContractAction(formData: FormData) {
  await requireCurrentEmployee();
  const schema = z.object({
    employeeId: z.uuid(),
    contractNo: z.string().trim().min(2).max(80),
    contractType: z.enum([
      "fixed_term",
      "indefinite",
      "intern",
      "part_time",
      "confidentiality",
      "other",
    ]),
    startsOn: z.iso.date(),
    endsOn: optionalDate,
    probationEndOn: optionalDate,
    status: z.enum(["draft", "active", "expired", "terminated"]),
    note: z.string().trim().max(500),
  });
  const parsed = schema.safeParse({
    employeeId: formData.get("employeeId"),
    contractNo: formData.get("contractNo"),
    contractType: formData.get("contractType"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    probationEndOn: formData.get("probationEndOn"),
    status: formData.get("status"),
    note: formData.get("note") ?? "",
  });

  if (
    !parsed.success ||
    (parsed.data.endsOn && parsed.data.endsOn < parsed.data.startsOn)
  ) {
    const employeeId = String(formData.get("employeeId") ?? "");
    redirect(`/employees/${employeeId}?error=invalid_contract`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_employee_contract", {
    p_employee_id: parsed.data.employeeId,
    p_contract_no: parsed.data.contractNo,
    p_contract_type: parsed.data.contractType,
    p_starts_on: parsed.data.startsOn,
    p_ends_on: parsed.data.endsOn,
    p_probation_end_on: parsed.data.probationEndOn,
    p_status: parsed.data.status,
    p_note: parsed.data.note || null,
  });

  if (error) {
    employeeDetailRedirect(parsed.data.employeeId, {
      error: error.message.includes("合同编号已存在")
        ? "duplicate_contract"
        : errorCode(error.message),
    });
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  employeeDetailRedirect(parsed.data.employeeId, {
    contractCreated: String(data),
  });
}

export async function saveEmployeeLeaveBalanceAction(formData: FormData) {
  await requireCurrentEmployee();
  const schema = z.object({
    employeeId: z.uuid(),
    balanceYear: z.coerce.number().int().min(2020).max(2100),
    annualEntitled: z.coerce.number().min(0).max(365),
    annualUsed: z.coerce.number().min(0).max(365),
    compensatoryEntitled: z.coerce.number().min(0).max(365),
    compensatoryUsed: z.coerce.number().min(0).max(365),
    sickUsed: z.coerce.number().min(0).max(365),
  });
  const parsed = schema.safeParse({
    employeeId: formData.get("employeeId"),
    balanceYear: formData.get("balanceYear"),
    annualEntitled: formData.get("annualEntitled"),
    annualUsed: formData.get("annualUsed"),
    compensatoryEntitled: formData.get("compensatoryEntitled"),
    compensatoryUsed: formData.get("compensatoryUsed"),
    sickUsed: formData.get("sickUsed"),
  });

  if (
    !parsed.success ||
    parsed.data.annualUsed > parsed.data.annualEntitled ||
    parsed.data.compensatoryUsed > parsed.data.compensatoryEntitled
  ) {
    const employeeId = String(formData.get("employeeId") ?? "");
    redirect(`/employees/${employeeId}?error=invalid_leave_balance`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_employee_leave_balance", {
    p_employee_id: parsed.data.employeeId,
    p_balance_year: parsed.data.balanceYear,
    p_annual_entitled: parsed.data.annualEntitled,
    p_annual_used: parsed.data.annualUsed,
    p_compensatory_entitled: parsed.data.compensatoryEntitled,
    p_compensatory_used: parsed.data.compensatoryUsed,
    p_sick_used: parsed.data.sickUsed,
  });

  if (error) {
    employeeDetailRedirect(parsed.data.employeeId, {
      error: errorCode(error.message),
    });
  }

  revalidatePath(`/employees/${parsed.data.employeeId}`);
  employeeDetailRedirect(parsed.data.employeeId, { leaveSaved: "1" });
}

export async function recordEmployeeChangeAction(formData: FormData) {
  await requireCurrentEmployee();
  const schema = z.object({
    employeeId: z.uuid(),
    changeType: z.enum([
      "hire",
      "transfer",
      "promotion",
      "regularization",
      "departure",
      "rehire",
      "other",
    ]),
    effectiveOn: z.iso.date(),
    toDepartmentId: nullableUuid,
    toTitle: z.string().trim().max(80),
    toEmploymentStatus: z.enum([
      "active",
      "departed",
      "probation",
      "intern",
      "part_time",
    ]),
    reason: z.string().trim().min(2).max(500),
  });
  const parsed = schema.safeParse({
    employeeId: formData.get("employeeId"),
    changeType: formData.get("changeType"),
    effectiveOn: formData.get("effectiveOn"),
    toDepartmentId: formData.get("toDepartmentId"),
    toTitle: formData.get("toTitle") ?? "",
    toEmploymentStatus: formData.get("toEmploymentStatus"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    const employeeId = String(formData.get("employeeId") ?? "");
    redirect(`/employees/${employeeId}?error=invalid_employee_change`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_employee_change", {
    p_employee_id: parsed.data.employeeId,
    p_change_type: parsed.data.changeType,
    p_effective_on: parsed.data.effectiveOn,
    p_to_department_id: parsed.data.toDepartmentId,
    p_to_title: parsed.data.toTitle || null,
    p_to_employment_status: parsed.data.toEmploymentStatus,
    p_reason: parsed.data.reason,
  });

  if (error) {
    employeeDetailRedirect(parsed.data.employeeId, {
      error: errorCode(error.message),
    });
  }

  revalidatePath("/employees");
  revalidatePath("/organization");
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  employeeDetailRedirect(parsed.data.employeeId, { changeCreated: "1" });
}
