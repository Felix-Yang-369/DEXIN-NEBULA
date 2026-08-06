"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

function stringValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function customerRedirect(params: Record<string, string>): never {
  redirect(`/customers?${new URLSearchParams(params).toString()}`);
}

async function requireCustomerManager() {
  const employee = await requireCurrentEmployee();

  if (employee.roleCodes.includes("admin")) {
    return employee;
  }

  if (!employee.departmentId) {
    customerRedirect({ error: "只有销售、客服或系统管理员可以执行此操作" });
  }

  const supabase = await createClient();
  const { data: department } = await supabase
    .from("departments")
    .select("code")
    .eq("id", employee.departmentId)
    .maybeSingle();

  if (!["DX-SALES", "DX-CS"].includes(department?.code ?? "")) {
    customerRedirect({ error: "只有销售、客服或系统管理员可以执行此操作" });
  }

  return employee;
}

async function requireLegalEntityManager() {
  const employee = await requireCurrentEmployee();

  if (
    employee.roleCodes.includes("admin") ||
    employee.roleCodes.includes("finance")
  ) {
    return employee;
  }

  if (!employee.departmentId) {
    customerRedirect({ error: "只有销售、客服、财务或系统管理员可以维护法律实体" });
  }

  const supabase = await createClient();
  const { data: department } = await supabase
    .from("departments")
    .select("code")
    .eq("id", employee.departmentId)
    .maybeSingle();

  if (!["DX-SALES", "DX-CS"].includes(department?.code ?? "")) {
    customerRedirect({ error: "只有销售、客服、财务或系统管理员可以维护法律实体" });
  }

  return employee;
}

async function requireFinanceManager(customerId: string) {
  const employee = await requireCurrentEmployee();
  if (!employee.roleCodes.includes("finance")) {
    customerDetailRedirect(customerId, {
      error: "只有财务角色可以维护法律实体的银行账户",
    });
  }
  return employee;
}

function optionalDate(value: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

const customerLogoMimeTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

function customerDetailRedirect(
  customerId: string,
  params: Record<string, string>,
): never {
  const safeId = /^[0-9a-f-]{36}$/i.test(customerId) ? customerId : "";
  redirect(
    safeId
      ? `/customers/${safeId}?${new URLSearchParams(params).toString()}`
      : `/customers?${new URLSearchParams(params).toString()}`,
  );
}

export async function createCustomer(formData: FormData) {
  await requireCustomerManager();
  const name = stringValue(formData, "name");
  const customerType = stringValue(formData, "customerType");
  const level = stringValue(formData, "level");
  const status = stringValue(formData, "status");
  const source = stringValue(formData, "source");
  const region = stringValue(formData, "region");
  const address = stringValue(formData, "address");
  const tags = stringValue(formData, "tags")
    .split(/[,，、]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
  const ownerEmployeeId = stringValue(formData, "ownerEmployeeId");
  const note = stringValue(formData, "note");
  const contactName = stringValue(formData, "contactName");
  const contactPosition = stringValue(formData, "contactPosition");
  const contactPhone = stringValue(formData, "contactPhone");
  const contactEmail = stringValue(formData, "contactEmail");
  const contactWechat = stringValue(formData, "contactWechat");

  if (!name || name.length > 120) {
    customerRedirect({ error: "请输入 1 至 120 个字的客户名称" });
  }

  if (
    !["catering", "gift", "distributor", "enterprise", "other"].includes(
      customerType,
    ) ||
    !["S", "A", "B", "C"].includes(level) ||
    !["lead", "prospect", "active", "inactive"].includes(status)
  ) {
    customerRedirect({ error: "客户分类或状态无效" });
  }

  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    customerRedirect({ error: "联系人邮箱格式不正确" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_customer_with_contact", {
    p_name: name,
    p_customer_type: customerType,
    p_level: level,
    p_status: status,
    p_source: source || null,
    p_region: region || null,
    p_address: address || null,
    p_tags: tags,
    p_owner_employee_id: ownerEmployeeId || null,
    p_note: note || null,
    p_contact_name: contactName || null,
    p_contact_position: contactPosition || null,
    p_contact_phone: contactPhone || null,
    p_contact_email: contactEmail || null,
    p_contact_wechat: contactWechat || null,
  });

  if (error) {
    console.error("createCustomer failed", error.code);
    customerRedirect({ error: "客户创建失败，请检查客户名称是否重复" });
  }

  const result = data as { customerNo?: string } | null;
  revalidatePath("/customers");
  customerRedirect({
    created: result?.customerNo
      ? `客户 ${result.customerNo} 已创建`
      : "客户已创建",
  });
}

export async function updateCustomer(formData: FormData) {
  await requireCustomerManager();
  const customerId = stringValue(formData, "customerId");
  const name = stringValue(formData, "name");
  const customerType = stringValue(formData, "customerType");
  const level = stringValue(formData, "level");
  const status = stringValue(formData, "status");
  const source = stringValue(formData, "source");
  const region = stringValue(formData, "region");
  const address = stringValue(formData, "address");
  const tags = stringValue(formData, "tags")
    .split(/[,，、]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
  const ownerEmployeeId = stringValue(formData, "ownerEmployeeId");
  const note = stringValue(formData, "note");
  const contactName = stringValue(formData, "contactName");
  const contactPosition = stringValue(formData, "contactPosition");
  const contactPhone = stringValue(formData, "contactPhone");
  const contactEmail = stringValue(formData, "contactEmail");
  const contactWechat = stringValue(formData, "contactWechat");
  const nextFollowUpOn = optionalDate(
    stringValue(formData, "nextFollowUpOn"),
  );

  if (!customerId) {
    customerRedirect({ error: "客户档案不存在或无权编辑" });
  }
  if (!name || name.length > 120) {
    customerRedirect({ error: "请输入 1 至 120 个字的客户名称" });
  }
  if (
    !["catering", "gift", "distributor", "enterprise", "other"].includes(
      customerType,
    ) ||
    !["S", "A", "B", "C"].includes(level) ||
    !["lead", "prospect", "active", "inactive"].includes(status)
  ) {
    customerRedirect({ error: "客户分类或状态无效" });
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    customerRedirect({ error: "联系人邮箱格式不正确" });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "update_customer_with_primary_contact",
    {
      p_customer_id: customerId,
      p_name: name,
      p_customer_type: customerType,
      p_level: level,
      p_status: status,
      p_source: source || null,
      p_region: region || null,
      p_address: address || null,
      p_tags: tags,
      p_owner_employee_id: ownerEmployeeId || null,
      p_note: note || null,
      p_contact_name: contactName || null,
      p_contact_position: contactPosition || null,
      p_contact_phone: contactPhone || null,
      p_contact_email: contactEmail || null,
      p_contact_wechat: contactWechat || null,
      p_next_follow_up_on: nextFollowUpOn,
    },
  );

  if (error) {
    console.error("updateCustomer failed", error.code);
    customerRedirect({
      error: "客户档案保存失败，请检查名称是否重复或确认维护权限",
    });
  }

  revalidatePath("/customers");
  customerRedirect({ updated: "客户档案已保存" });
}

export async function uploadCustomerLogo(formData: FormData) {
  const employee = await requireCustomerManager();
  const customerId = stringValue(formData, "customerId");
  const file = formData.get("logo");

  if (
    !/^[0-9a-f-]{36}$/i.test(customerId) ||
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 2 * 1024 * 1024 ||
    !(file.type in customerLogoMimeTypes)
  ) {
    customerRedirect({
      error: "请选择 2MB 以内的 JPG、PNG 或 WebP 企业 Logo",
    });
  }

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("customer_no, logo_path")
    .eq("id", customerId)
    .maybeSingle();

  if (!customer) {
    customerRedirect({ error: "客户档案不存在或无权维护" });
  }

  const extension =
    customerLogoMimeTypes[file.type as keyof typeof customerLogoMimeTypes];
  const logoPath = `${employee.organizationId}/${customer.customer_no}/logo.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("customer-logos")
    .upload(logoPath, file, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("uploadCustomerLogo storage failed", uploadError.message);
    customerRedirect({ error: "企业 Logo 上传失败，请稍后重试" });
  }

  const { error: profileError } = await supabase.rpc("set_customer_logo", {
    p_customer_id: customerId,
    p_logo_path: logoPath,
  });

  if (profileError) {
    console.error("uploadCustomerLogo profile failed", profileError.code);
    await supabase.storage.from("customer-logos").remove([logoPath]);
    customerRedirect({ error: "企业 Logo 保存失败，请确认维护权限" });
  }

  if (customer.logo_path && customer.logo_path !== logoPath) {
    await supabase.storage.from("customer-logos").remove([customer.logo_path]);
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  customerRedirect({ updated: "企业 Logo 已更新" });
}

export async function createCustomerContact(formData: FormData) {
  await requireCustomerManager();
  const customerId = stringValue(formData, "customerId");
  const name = stringValue(formData, "name");
  const position = stringValue(formData, "position");
  const phone = stringValue(formData, "phone");
  const email = stringValue(formData, "email");
  const wechat = stringValue(formData, "wechat");
  const isPrimary = formData.get("isPrimary") === "on";

  if (!/^[0-9a-f-]{36}$/i.test(customerId)) {
    customerRedirect({ error: "客户档案不存在或无权编辑" });
  }
  if (name.length < 1 || name.length > 80) {
    customerDetailRedirect(customerId, {
      error: "联系人姓名需为 1 至 80 个字",
    });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    customerDetailRedirect(customerId, {
      error: "联系人邮箱格式不正确",
    });
  }
  if (!phone && !email && !wechat) {
    customerDetailRedirect(customerId, {
      error: "电话、邮箱和微信至少填写一项",
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_customer_contact", {
    p_customer_id: customerId,
    p_name: name,
    p_position: position || null,
    p_phone: phone || null,
    p_email: email || null,
    p_wechat: wechat || null,
    p_is_primary: isPrimary,
  });

  if (error) {
    console.error("createCustomerContact failed", error.code);
    customerDetailRedirect(customerId, {
      error: "联系人保存失败，请确认维护权限后重试",
    });
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  customerDetailRedirect(customerId, { created: "联系人已添加" });
}

export async function recordCustomerFollowup(formData: FormData) {
  await requireCustomerManager();
  const customerId = stringValue(formData, "customerId");
  const returnToDetail = stringValue(formData, "returnTo") === "detail";
  const followupType = stringValue(formData, "followupType");
  const summary = stringValue(formData, "summary");
  const nextFollowUpOn = optionalDate(stringValue(formData, "nextFollowUpOn"));
  const finish = (params: Record<string, string>): never =>
    returnToDetail
      ? customerDetailRedirect(customerId, params)
      : customerRedirect(params);

  if (!customerId) {
    finish({ error: "请选择客户" });
  }

  if (!["call", "wechat", "visit", "email", "other"].includes(followupType)) {
    finish({ error: "请选择正确的跟进方式" });
  }

  if (summary.length < 2 || summary.length > 500) {
    finish({ error: "跟进内容需为 2 至 500 个字" });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_customer_followup", {
    p_customer_id: customerId,
    p_followup_type: followupType,
    p_summary: summary,
    p_next_follow_up_on: nextFollowUpOn,
  });

  if (error) {
    console.error("recordCustomerFollowup failed", error.code);
    finish({ error: "客户跟进保存失败，请检查权限或稍后重试" });
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  finish({ created: "客户跟进已记录" });
}

export async function createCustomerLegalEntity(formData: FormData) {
  const employee = await requireLegalEntityManager();
  const customerId = stringValue(formData, "customerId");
  const legalName = stringValue(formData, "legalName");
  const shortName = stringValue(formData, "shortName");
  const creditCode = stringValue(formData, "creditCode").toUpperCase();
  const entityType = stringValue(formData, "entityType");
  const taxpayerType = stringValue(formData, "taxpayerType");
  const registeredAddress = stringValue(formData, "registeredAddress");
  const invoicePhone = stringValue(formData, "invoicePhone");
  const invoiceEmail = stringValue(formData, "invoiceEmail");
  const isDefault = formData.get("isDefault") === "on";
  const note = stringValue(formData, "note");

  if (!/^[0-9a-f-]{36}$/i.test(customerId)) {
    customerRedirect({ error: "客户档案不存在或无权维护" });
  }
  if (legalName.length < 2 || legalName.length > 160) {
    customerDetailRedirect(customerId, {
      error: "法律实体全称需为 2 至 160 个字",
    });
  }
  if (shortName.length > 80) {
    customerDetailRedirect(customerId, { error: "法律实体简称不能超过 80 个字" });
  }
  if (creditCode && !/^[0-9A-Z]{18}$/.test(creditCode)) {
    customerDetailRedirect(customerId, {
      error: "统一社会信用代码应为 18 位数字或大写字母",
    });
  }
  if (!["company", "individual_business", "government", "other"].includes(entityType)) {
    customerDetailRedirect(customerId, { error: "法律实体类型无效" });
  }
  if (!["general", "small_scale", "non_taxable", "other"].includes(taxpayerType)) {
    customerDetailRedirect(customerId, { error: "纳税人类型无效" });
  }
  if (invoiceEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceEmail)) {
    customerDetailRedirect(customerId, { error: "开票邮箱格式不正确" });
  }

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();

  if (!customer) {
    customerDetailRedirect(customerId, { error: "客户档案不存在或无权维护" });
  }

  const entityCode = `DXLE-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 6)
    .toUpperCase()}`;
  const { error } = await supabase.from("customer_legal_entities").insert({
    organization_id: employee.organizationId,
    customer_id: customerId,
    entity_code: entityCode,
    legal_name: legalName,
    short_name: shortName || null,
    unified_social_credit_code: creditCode || null,
    entity_type: entityType,
    taxpayer_type: taxpayerType,
    registered_address: registeredAddress || null,
    invoice_phone: invoicePhone || null,
    invoice_email: invoiceEmail || null,
    is_default: isDefault,
    note: note || null,
    created_by_employee_id: employee.id,
  });

  if (error) {
    console.error("createCustomerLegalEntity failed", error.code);
    customerDetailRedirect(customerId, {
      error: "法律实体保存失败，请检查名称或统一社会信用代码是否重复",
    });
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/finance");
  customerDetailRedirect(customerId, { created: "法律实体已添加" });
}

export async function createLegalEntityBankAccount(formData: FormData) {
  const customerId = stringValue(formData, "customerId");
  const employee = await requireFinanceManager(customerId);
  const legalEntityId = stringValue(formData, "legalEntityId");
  const accountName = stringValue(formData, "accountName");
  const bankName = stringValue(formData, "bankName");
  const bankBranch = stringValue(formData, "bankBranch");
  const accountNo = stringValue(formData, "accountNo").replaceAll(/\s/g, "");
  const currency = stringValue(formData, "currency").toUpperCase() || "CNY";
  const isDefault = formData.get("isDefault") === "on";
  const note = stringValue(formData, "note");

  if (
    !/^[0-9a-f-]{36}$/i.test(customerId) ||
    !/^[0-9a-f-]{36}$/i.test(legalEntityId)
  ) {
    customerDetailRedirect(customerId, { error: "法律实体不存在" });
  }
  if (accountName.length < 2 || accountName.length > 160) {
    customerDetailRedirect(customerId, { error: "请输入有效的银行账户名称" });
  }
  if (bankName.length < 2 || bankName.length > 120) {
    customerDetailRedirect(customerId, { error: "请输入有效的开户银行" });
  }
  if (!/^[0-9A-Za-z-]{6,40}$/.test(accountNo)) {
    customerDetailRedirect(customerId, { error: "请输入 6 至 40 位有效银行账号" });
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    customerDetailRedirect(customerId, { error: "币种代码格式不正确" });
  }

  const supabase = await createClient();
  const { data: entity } = await supabase
    .from("customer_legal_entities")
    .select("id")
    .eq("id", legalEntityId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (!entity) {
    customerDetailRedirect(customerId, { error: "法律实体不存在或不属于该客户" });
  }

  const { error } = await supabase.from("legal_entity_bank_accounts").insert({
    organization_id: employee.organizationId,
    legal_entity_id: legalEntityId,
    account_name: accountName,
    bank_name: bankName,
    bank_branch: bankBranch || null,
    account_no: accountNo,
    currency,
    is_default: isDefault,
    note: note || null,
    created_by_employee_id: employee.id,
  });

  if (error) {
    console.error("createLegalEntityBankAccount failed", error.code);
    customerDetailRedirect(customerId, {
      error: "银行账户保存失败，请检查账号是否重复",
    });
  }

  revalidatePath(`/customers/${customerId}`);
  customerDetailRedirect(customerId, { created: "银行账户已添加" });
}
