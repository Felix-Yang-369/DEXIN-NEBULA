"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

const notificationSchema = z.object({
  notificationId: z.uuid(),
  href: z.string().trim().max(200).default("/notifications"),
});

function safeInternalHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//")
    ? href
    : "/notifications";
}

export async function readNotificationAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = notificationSchema.safeParse({
    notificationId: formData.get("notificationId"),
    href: formData.get("href") ?? "/notifications",
  });

  if (!parsed.success) {
    redirect("/notifications?error=invalid_notification");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: parsed.data.notificationId,
  });

  if (error) {
    redirect("/notifications?error=read_failed");
  }

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect(safeInternalHref(parsed.data.href));
}

export async function readAllNotificationsAction() {
  await requireCurrentEmployee();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_all_notifications_read");

  if (error) {
    redirect("/notifications?error=read_all_failed");
  }

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect("/notifications?updated=1");
}
