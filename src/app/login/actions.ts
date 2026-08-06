"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type LoginActionState = {
  error: string;
};

const loginSchema = z.object({
  email: z.string().trim().email("请输入正确的企业邮箱"),
  password: z.string().min(8, "密码至少需要 8 位"),
  next: z
    .string()
    .optional()
    .transform((value) =>
      value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard",
    ),
});

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase 尚未配置，暂时不能使用真实账号登录。" };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "登录信息不完整" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: "邮箱或密码不正确，请重新输入。" };
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, status")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (!employee || employee.status !== "active") {
    await supabase.auth.signOut();
    return { error: "该账号尚未绑定在职员工，或已被停用。" };
  }

  redirect(parsed.data.next);
}
