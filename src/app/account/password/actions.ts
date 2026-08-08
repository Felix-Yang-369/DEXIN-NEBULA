"use server";

import { redirect } from "next/navigation";
import {
  passwordConfirmationError,
  passwordPolicyError,
} from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/server";

export async function changeOwnPasswordAction(formData: FormData) {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");
  const validationError =
    passwordPolicyError(password) ??
    passwordConfirmationError(password, confirmation);
  if (!currentPassword || validationError) {
    redirect(
      `/account/password?error=${encodeURIComponent(validationError ?? "请输入当前密码。")}`,
    );
  }
  if (currentPassword === password) {
    redirect(
      `/account/password?error=${encodeURIComponent("新密码不能与当前密码相同。")}`,
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) redirect("/login?next=/account/password");

  const { error: verificationError } = await supabase.auth.signInWithPassword({
    email: data.user.email,
    password: currentPassword,
  });
  if (verificationError) {
    redirect("/account/password?error=current_password_invalid");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("Own password update failed", error);
    redirect("/account/password?error=update_failed");
  }

  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?error=password_changed");
}
