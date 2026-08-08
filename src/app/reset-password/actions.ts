"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PASSWORD_RECOVERY_COOKIE,
  passwordConfirmationError,
  passwordPolicyError,
} from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/server";

export async function resetRecoveredPasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");
  const validationError =
    passwordPolicyError(password) ??
    passwordConfirmationError(password, confirmation);
  if (validationError) {
    redirect(`/reset-password?error=${encodeURIComponent(validationError)}`);
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const recoveryUserId = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value;
  if (!data.user || recoveryUserId !== data.user.id) {
    cookieStore.delete(PASSWORD_RECOVERY_COOKIE);
    redirect("/forgot-password?error=invalid_link");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("Recovered password update failed", error);
    redirect("/reset-password?error=update_failed");
  }

  cookieStore.delete(PASSWORD_RECOVERY_COOKIE);
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?error=password_changed");
}
