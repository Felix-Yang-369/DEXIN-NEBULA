"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

const quoteItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive().max(999999),
});

const quoteSchema = z.object({
  customerId: z.string().uuid(),
  priceType: z.enum(["retail", "group", "dropship"]),
  validUntil: z.iso.date(),
  paymentTerms: z.string().trim().max(500),
  deliveryTerms: z.string().trim().max(500),
  note: z.string().trim().max(2000),
  items: z.array(quoteItemSchema).min(1).max(50),
});

function quotesRedirect(params: Record<string, string>): never {
  redirect(`/quotes?${new URLSearchParams(params).toString()}`);
}

function quoteDetailRedirect(
  quoteId: string,
  params: Record<string, string>,
): never {
  const safeId = z.uuid().safeParse(quoteId).success ? quoteId : "";
  redirect(
    safeId
      ? `/quotes/${safeId}?${new URLSearchParams(params).toString()}`
      : `/quotes?${new URLSearchParams(params).toString()}`,
  );
}

function parseItems(value: FormDataEntryValue | null) {
  try {
    return JSON.parse(String(value ?? "[]")) as unknown;
  } catch {
    return null;
  }
}

export async function createSalesQuoteAction(formData: FormData) {
  await requireCurrentEmployee();

  const parsed = quoteSchema.safeParse({
    customerId: formData.get("customerId"),
    priceType: formData.get("priceType"),
    validUntil: formData.get("validUntil"),
    paymentTerms: formData.get("paymentTerms") ?? "",
    deliveryTerms: formData.get("deliveryTerms") ?? "",
    note: formData.get("note") ?? "",
    items: parseItems(formData.get("items")),
  });

  if (!parsed.success) {
    quotesRedirect({
      error: "报价资料格式不正确，请检查客户、有效期和商品数量",
    });
  }

  const uniqueProductIds = new Set(
    parsed.data.items.map((item) => item.productId),
  );
  if (uniqueProductIds.size !== parsed.data.items.length) {
    quotesRedirect({ error: "同一商品不能重复添加到报价单" });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validUntil = new Date(`${parsed.data.validUntil}T00:00:00`);
  const maxValidUntil = new Date(today);
  maxValidUntil.setDate(maxValidUntil.getDate() + 90);
  if (validUntil < today || validUntil > maxValidUntil) {
    quotesRedirect({ error: "报价有效期需在未来 90 天内" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_sales_quote", {
    p_customer_id: parsed.data.customerId,
    p_price_type: parsed.data.priceType,
    p_valid_until: parsed.data.validUntil,
    p_payment_terms: parsed.data.paymentTerms || null,
    p_delivery_terms: parsed.data.deliveryTerms || null,
    p_note: parsed.data.note || null,
    p_items: parsed.data.items,
  });

  if (error || !data) {
    console.error("createSalesQuoteAction failed", error?.code);
    const message = error?.message ?? "";
    quotesRedirect({
      error: message.includes("未配置")
        ? "所选商品缺少当前报价类型的有效价格"
        : message.includes("权限") || error?.code === "42501"
          ? "当前账号没有创建此报价单的权限"
          : "报价单保存失败，请检查客户和产品价格后重试",
    });
  }

  const result = data as { quoteNo?: string };
  revalidatePath("/quotes");
  quotesRedirect({
    created: result.quoteNo
      ? `报价单 ${result.quoteNo} 已保存为草稿`
      : "报价单已保存为草稿",
  });
}

const quoteTransitionSchema = z.object({
  quoteId: z.string().uuid(),
  targetStatus: z.enum(["sent", "accepted", "rejected", "expired"]),
  note: z.string().trim().max(1000),
});

const transitionSuccessLabels: Record<
  z.infer<typeof quoteTransitionSchema>["targetStatus"],
  string
> = {
  sent: "报价单已标记为已发送",
  accepted: "已记录客户接受报价",
  rejected: "已记录客户拒绝报价",
  expired: "报价单已标记为过期",
};

export async function transitionSalesQuoteAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = quoteTransitionSchema.safeParse({
    quoteId: formData.get("quoteId"),
    targetStatus: formData.get("targetStatus"),
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    quotesRedirect({ error: "报价状态操作参数无效" });
  }

  if (
    ["accepted", "rejected"].includes(parsed.data.targetStatus) &&
    !parsed.data.note
  ) {
    quoteDetailRedirect(parsed.data.quoteId, {
      error: "记录客户接受或拒绝时必须填写说明",
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_sales_quote", {
    p_quote_id: parsed.data.quoteId,
    p_target_status: parsed.data.targetStatus,
    p_note: parsed.data.note || null,
  });

  if (error) {
    console.error("transitionSalesQuoteAction failed", error.code);
    quoteDetailRedirect(parsed.data.quoteId, {
      error:
        error.code === "42501"
          ? "当前账号无权更新报价状态"
          : "当前报价状态不能执行此操作，请刷新后重试",
    });
  }

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${parsed.data.quoteId}`);
  quoteDetailRedirect(parsed.data.quoteId, {
    updated: transitionSuccessLabels[parsed.data.targetStatus],
  });
}
