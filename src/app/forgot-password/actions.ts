"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getPasswordRecoveryRedirectUrl } from "@/lib/auth/password";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const recoveryRequestSchema = z.object({
  email: z.string().trim().email(),
});

export async function requestPasswordResetAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/forgot-password?error=unavailable");
  }

  const parsed = recoveryRequestSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    redirect("/forgot-password?error=invalid_email");
  }

  let redirectTo: string;
  try {
    redirectTo = getPasswordRecoveryRedirectUrl();
  } catch (error) {
    console.error("Password recovery URL is invalid", error);
    redirect("/forgot-password?error=unavailable");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo },
  );

  // Always return the same response so the form cannot enumerate employee accounts.
  if (error) console.error("Password recovery request failed", error);
  redirect("/forgot-password?sent=1");
}
