import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyAiQuery,
  extractSearchTerms,
  relevanceScore,
  searchableText,
} from "@/features/ai/search";
import type {
  AiRetrievalAudit,
  AiSource,
} from "@/features/ai/types";

type RetrievalResult = {
  context: string;
  sources: AiSource[];
  audits: AiRetrievalAudit[];
};

function compact(value: unknown, max = 600) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function ranked<T>(
  rows: T[],
  terms: string[],
  values: (row: T) => unknown[],
  limit: number,
) {
  return rows
    .map((row) => ({
      row,
      score: relevanceScore(searchableText(values(row)), terms),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.row);
}

export async function retrieveAiContext(
  supabase: SupabaseClient,
  query: string,
): Promise<RetrievalResult> {
  const terms = extractSearchTerms(query);
  const intent = classifyAiQuery(query);
  if (terms.length === 0) {
    return { context: "", sources: [], audits: [] };
  }

  const startedAt = Date.now();
  const sourceLimit = intent.hasExplicitIntent ? 4 : 2;
  const [
    knowledgeResult,
    productResult,
    inventoryResult,
    customerResult,
    supplierResult,
    employeeResult,
    announcementResult,
    documentResult,
    approvalResult,
    quoteResult,
    financeResult,
  ] = await Promise.all([
    supabase
      .from("knowledge_documents")
      .select("id, slug, title, summary, content, keywords, updated_at")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(120),
    supabase
      .from("products")
      .select(
        "id, code, name, short_name, brand, specification, case_specification, shelf_life, stock_status, minimum_order, applicable_scenarios, description, delivery_notes, invoice_notes, keywords, customer_query_reply, out_of_stock_reply, order_guide_reply, updated_at",
      )
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("inventory_items")
      .select(
        "id, product_id, sku, product_name, specification, barcode, quantity, available_quantity, reserved_quantity, quarantined_quantity, unit, location_code, warehouses(name)",
      )
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("customers")
      .select(
        "id, customer_no, name, customer_type, level, status, source, region, tags, last_contact_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("suppliers")
      .select(
        "id, supplier_no, name, short_name, category, cooperation_level, cooperation_status, business_scope, settlement_terms, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(160),
    supabase
      .from("employees")
      .select("id, employee_no, name, title, hired_on, status, departments(name)")
      .order("name")
      .limit(160),
    supabase
      .from("announcements")
      .select(
        "id, title, summary, content, category_code, published_at, updated_at",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(100),
    supabase
      .from("business_documents")
      .select(
        "id, document_no, category, title, description, original_file_name, related_party_name, reference_no, effective_on, expires_on, updated_at",
      )
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(160),
    supabase
      .from("approval_requests")
      .select(
        "id, request_no, request_type, title, summary, status, submitted_at, completed_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(120),
    supabase
      .from("sales_quotes")
      .select(
        "id, quote_no, status, price_type, valid_until, total_cny, payment_terms, delivery_terms, created_at, updated_at, customers(name)",
      )
      .order("updated_at", { ascending: false })
      .limit(120),
    supabase
      .from("finance_documents")
      .select(
        "id, document_no, document_type, counterparty_name, source_type, source_no, issue_date, due_date, total_amount, settled_amount, status, invoice_no, summary, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);

  const knowledge = intent.knowledge
    ? ranked(
        knowledgeResult.data ?? [],
        terms,
        (item) => [
          item.title,
          item.summary,
          item.content,
          item.keywords,
        ],
        sourceLimit,
      )
    : [];
  const productCandidates = intent.productCode
    ? (productResult.data ?? []).filter(
        (item) => item.code.toUpperCase() === intent.productCode,
      )
    : productResult.data ?? [];
  const products = intent.product
    ? ranked(
        productCandidates,
        terms,
        (item) => [
          item.code,
          item.name,
          item.short_name,
          item.brand,
          item.specification,
          item.applicable_scenarios,
          item.description,
          item.keywords,
        ],
        intent.productCode ? 1 : sourceLimit,
      )
    : [];
  const inventory = intent.inventory
    ? ranked(
        inventoryResult.data ?? [],
        terms,
        (item) => [
          item.sku,
          item.product_name,
          item.specification,
          item.barcode,
          item.location_code,
        ],
        sourceLimit,
      )
    : [];
  const customers = intent.customer
    ? ranked(
        customerResult.data ?? [],
        terms,
        (item) => [
          item.customer_no,
          item.name,
          item.customer_type,
          item.level,
          item.status,
          item.source,
          item.region,
          item.tags,
        ],
        sourceLimit,
      )
    : [];
  const suppliers = intent.supplier
    ? ranked(
        supplierResult.data ?? [],
        terms,
        (item) => [
          item.supplier_no,
          item.name,
          item.short_name,
          item.category,
          item.cooperation_level,
          item.cooperation_status,
          item.business_scope,
          item.settlement_terms,
        ],
        sourceLimit,
      )
    : [];
  const employees = intent.employee
    ? ranked(
        employeeResult.data ?? [],
        terms,
        (item) => [
          item.employee_no,
          item.name,
          item.title,
          relatedOne(item.departments)?.name,
        ],
        sourceLimit,
      )
    : [];
  const announcements = intent.announcement
    ? ranked(
        announcementResult.data ?? [],
        terms,
        (item) => [item.title, item.summary, item.content, item.category_code],
        sourceLimit,
      )
    : [];
  const documents = intent.document
    ? ranked(
        documentResult.data ?? [],
        terms,
        (item) => [
          item.document_no,
          item.category,
          item.title,
          item.description,
          item.original_file_name,
          item.related_party_name,
          item.reference_no,
        ],
        sourceLimit,
      )
    : [];
  const approvals = intent.approval
    ? ranked(
        approvalResult.data ?? [],
        terms,
        (item) => [
          item.request_no,
          item.request_type,
          item.title,
          item.summary,
          item.status,
        ],
        sourceLimit,
      )
    : [];
  const quotes = intent.quote
    ? ranked(
        quoteResult.data ?? [],
        terms,
        (item) => [
          item.quote_no,
          item.status,
          item.price_type,
          relatedOne(item.customers)?.name,
          item.payment_terms,
          item.delivery_terms,
        ],
        sourceLimit,
      )
    : [];
  const finances = intent.finance
    ? ranked(
        financeResult.data ?? [],
        terms,
        (item) => [
          item.document_no,
          item.document_type,
          item.counterparty_name,
          item.source_type,
          item.source_no,
          item.status,
          item.invoice_no,
          item.summary,
        ],
        sourceLimit,
      )
    : [];

  const productIds = products.map((product) => product.id);
  const priceResult =
    productIds.length > 0
      ? await supabase
          .from("product_prices")
          .select("product_id, price_type, amount_cny")
          .in("product_id", productIds)
          .eq("status", "active")
      : { data: [], error: null };
  const prices = new Map<string, string[]>();
  const priceLabels: Record<string, string> = {
    procurement: "含税集采自提价",
    retail: "建议零售价",
    group: "团购价",
    dropship: "一件代发价",
  };
  for (const price of priceResult.data ?? []) {
    const values = prices.get(price.product_id) ?? [];
    values.push(
      `${priceLabels[price.price_type] ?? price.price_type}：¥${Number(
        price.amount_cny,
      ).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`,
    );
    prices.set(price.product_id, values);
  }

  const sources: AiSource[] = [];
  const context: string[] = [];
  knowledge.forEach((item) => {
    const sourceIndex = sources.length + 1;
    sources.push({
      id: item.id,
      type: "knowledge",
      title: item.title,
      description: compact(item.summary, 120),
      href: `/knowledge/${item.slug}`,
      updatedAt: item.updated_at,
    });
    context.push(
      `[来源${sourceIndex}｜制度] ${item.title}\n摘要：${compact(
        item.summary,
        300,
      )}\n正文片段：${compact(item.content, 1000)}`,
    );
  });
  products.forEach((item) => {
    const sourceIndex = sources.length + 1;
    sources.push({
      id: item.id,
      type: "product",
      title: `${item.code} · ${item.name}`,
      description: [item.brand, item.specification, item.stock_status]
        .filter(Boolean)
        .join(" · "),
      href: `/products?product=${item.id}`,
      updatedAt: item.updated_at,
    });
    context.push(
      `[来源${sourceIndex}｜产品] ${item.code} · ${item.name}
品牌：${compact(item.brand)}；规格：${compact(item.specification)}；箱规：${compact(item.case_specification)}
保质期：${compact(item.shelf_life)}；库存口径：${compact(item.stock_status)}；起订量：${compact(item.minimum_order)}
当前账号可见价格：${prices.get(item.id)?.join("；") || "无可见价格"}
适用场景：${compact(item.applicable_scenarios, 300)}
产品说明：${compact(item.description, 500)}
配送说明：${compact(item.delivery_notes, 300)}
客户查询话术：${compact(item.customer_query_reply, 400)}
缺货话术：${compact(item.out_of_stock_reply, 300)}
下单引导：${compact(item.order_guide_reply, 300)}`,
    );
  });
  inventory.forEach((item) => {
    const sourceIndex = sources.length + 1;
    const warehouse = Array.isArray(item.warehouses)
      ? item.warehouses[0]
      : item.warehouses;
    sources.push({
      id: item.id,
      type: "inventory",
      title: `${item.sku} · ${item.product_name}`,
      description: `可用 ${Number(item.available_quantity)} ${item.unit}`,
      href: "/inventory",
    });
    context.push(
      `[来源${sourceIndex}｜库存] ${item.sku} · ${item.product_name}
规格：${compact(item.specification)}；仓库：${compact(warehouse?.name)}
物理库存：${Number(item.quantity)} ${item.unit}；可用库存：${Number(
        item.available_quantity,
      )} ${item.unit}；预留：${Number(item.reserved_quantity)} ${
        item.unit
      }；隔离：${Number(item.quarantined_quantity)} ${item.unit}
库位：${compact(item.location_code)}`,
    );
  });
  customers.forEach((item) => {
    const sourceIndex = sources.length + 1;
    sources.push({
      id: item.id,
      type: "customer",
      title: `${item.customer_no} · ${item.name}`,
      description: `${item.level} 级 · ${item.region || "地区待补充"} · ${item.status}`,
      href: `/customers/${item.id}`,
      updatedAt: item.updated_at,
    });
    context.push(
      `[来源${sourceIndex}｜客户] ${item.customer_no} · ${item.name}
客户类型：${compact(item.customer_type)}；等级：${compact(item.level)}；状态：${compact(item.status)}
地区：${compact(item.region)}；来源：${compact(item.source)}；标签：${compact(item.tags)}
最近联系：${compact(item.last_contact_at || "暂无记录")}`,
    );
  });
  suppliers.forEach((item) => {
    const sourceIndex = sources.length + 1;
    sources.push({
      id: item.id,
      type: "supplier",
      title: `${item.supplier_no} · ${item.name}`,
      description: `${item.cooperation_level} · ${item.cooperation_status}`,
      href: `/suppliers/${item.id}`,
      updatedAt: item.updated_at,
    });
    context.push(
      `[来源${sourceIndex}｜供应商] ${item.supplier_no} · ${item.name}
简称：${compact(item.short_name)}；品类：${compact(item.category)}；合作等级：${compact(item.cooperation_level)}；状态：${compact(item.cooperation_status)}
业务范围：${compact(item.business_scope, 400)}
当前账号可见结算条款：${compact(item.settlement_terms, 300)}`,
    );
  });
  employees.forEach((item) => {
    const sourceIndex = sources.length + 1;
    const department = relatedOne(item.departments);
    sources.push({
      id: item.id,
      type: "employee",
      title: `${item.name} · ${item.title || "员工"}`,
      description: `${department?.name || "未分配部门"} · ${item.employee_no}`,
      href: `/employees/${item.id}`,
    });
    context.push(
      `[来源${sourceIndex}｜员工通讯录] ${item.name}
员工编号：${compact(item.employee_no)}；部门：${compact(department?.name)}；岗位：${compact(item.title)}；状态：${compact(item.status)}
本条仅包含当前账号可见的非敏感任职信息。`,
    );
  });
  announcements.forEach((item) => {
    const sourceIndex = sources.length + 1;
    sources.push({
      id: item.id,
      type: "announcement",
      title: item.title,
      description: compact(item.summary, 120),
      href: `/announcements/${item.id}`,
      updatedAt: item.updated_at,
    });
    context.push(
      `[来源${sourceIndex}｜公告] ${item.title}
摘要：${compact(item.summary, 300)}
正文片段：${compact(item.content, 900)}
发布时间：${compact(item.published_at)}`,
    );
  });
  documents.forEach((item) => {
    const sourceIndex = sources.length + 1;
    sources.push({
      id: item.id,
      type: "document",
      title: `${item.document_no} · ${item.title}`,
      description: compact(
        [item.category, item.related_party_name, item.original_file_name]
          .filter(Boolean)
          .join(" · "),
        140,
      ),
      href: "/documents",
      updatedAt: item.updated_at,
    });
    context.push(
      `[来源${sourceIndex}｜文件元数据] ${item.document_no} · ${item.title}
分类：${compact(item.category)}；原文件名：${compact(item.original_file_name)}；相关方：${compact(item.related_party_name)}
关联单号：${compact(item.reference_no)}；有效日：${compact(item.effective_on)}；到期日：${compact(item.expires_on)}
说明：${compact(item.description, 400)}
注意：当前只检索文件元数据，未读取附件正文。`,
    );
  });
  approvals.forEach((item) => {
    const sourceIndex = sources.length + 1;
    sources.push({
      id: item.id,
      type: "approval",
      title: `${item.request_no} · ${item.title}`,
      description: `${item.request_type} · ${item.status}`,
      href: "/approvals",
      updatedAt: item.updated_at,
    });
    context.push(
      `[来源${sourceIndex}｜审批] ${item.request_no} · ${item.title}
类型：${compact(item.request_type)}；状态：${compact(item.status)}；摘要：${compact(item.summary, 400)}
提交时间：${compact(item.submitted_at)}；完成时间：${compact(item.completed_at || "尚未完成")}`,
    );
  });
  quotes.forEach((item) => {
    const sourceIndex = sources.length + 1;
    const customer = relatedOne(item.customers);
    sources.push({
      id: item.id,
      type: "quote",
      title: `${item.quote_no} · ${customer?.name || "客户报价"}`,
      description: `¥${Number(item.total_cny).toLocaleString("zh-CN")} · ${item.status}`,
      href: `/quotes/${item.id}`,
      updatedAt: item.updated_at,
    });
    context.push(
      `[来源${sourceIndex}｜报价单] ${item.quote_no} · ${compact(customer?.name)}
状态：${compact(item.status)}；价格类型：${compact(item.price_type)}；含税总额：¥${Number(item.total_cny).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}
有效期至：${compact(item.valid_until)}；付款条款：${compact(item.payment_terms, 300)}；交付条款：${compact(item.delivery_terms, 300)}`,
    );
  });
  finances.forEach((item) => {
    const sourceIndex = sources.length + 1;
    const outstanding = Number(item.total_amount) - Number(item.settled_amount);
    sources.push({
      id: item.id,
      type: "finance",
      title: `${item.document_no} · ${item.counterparty_name}`,
      description: `余额 ¥${outstanding.toLocaleString("zh-CN")} · ${item.status}`,
      href: "/finance",
      updatedAt: item.updated_at,
    });
    context.push(
      `[来源${sourceIndex}｜财务] ${item.document_no} · ${item.counterparty_name}
类型：${item.document_type === "receivable" ? "应收" : "应付"}；状态：${compact(item.status)}；摘要：${compact(item.summary, 300)}
总额：¥${Number(item.total_amount).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}；已核销：¥${Number(item.settled_amount).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}；未核销：¥${outstanding.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}
开单日：${compact(item.issue_date)}；到期日：${compact(item.due_date)}；来源单号：${compact(item.source_no)}；发票号：${compact(item.invoice_no)}`,
    );
  });

  const totalDuration = Date.now() - startedAt;
  const errors = [
    knowledgeResult.error,
    productResult.error,
    inventoryResult.error,
    customerResult.error,
    supplierResult.error,
    employeeResult.error,
    announcementResult.error,
    documentResult.error,
    approvalResult.error,
    quoteResult.error,
    financeResult.error,
    priceResult.error,
  ].filter(Boolean);
  if (errors.length > 0) {
    console.error(
      "retrieveAiContext partial failure",
      errors.map((error) => error?.code),
    );
  }

  const sourceIdsByType = (type: AiSource["type"]) =>
    sources.filter((source) => source.type === type).map((source) => source.id);
  return {
    context: context.join("\n\n"),
    sources,
    audits: [
      {
        toolName: "search_knowledge",
        queryText: query,
        resultCount: knowledge.length,
        sourceIds: sourceIdsByType("knowledge"),
        durationMs: totalDuration,
      },
      {
        toolName: "search_products",
        queryText: query,
        resultCount: products.length,
        sourceIds: sourceIdsByType("product"),
        durationMs: totalDuration,
      },
      {
        toolName: "search_inventory",
        queryText: query,
        resultCount: inventory.length,
        sourceIds: sourceIdsByType("inventory"),
        durationMs: totalDuration,
      },
      {
        toolName: "search_customers",
        queryText: query,
        resultCount: customers.length,
        sourceIds: sourceIdsByType("customer"),
        durationMs: totalDuration,
      },
      {
        toolName: "search_suppliers",
        queryText: query,
        resultCount: suppliers.length,
        sourceIds: sourceIdsByType("supplier"),
        durationMs: totalDuration,
      },
      {
        toolName: "search_employees",
        queryText: query,
        resultCount: employees.length,
        sourceIds: sourceIdsByType("employee"),
        durationMs: totalDuration,
      },
      {
        toolName: "search_announcements",
        queryText: query,
        resultCount: announcements.length,
        sourceIds: sourceIdsByType("announcement"),
        durationMs: totalDuration,
      },
      {
        toolName: "search_documents",
        queryText: query,
        resultCount: documents.length,
        sourceIds: sourceIdsByType("document"),
        durationMs: totalDuration,
      },
      {
        toolName: "search_approvals",
        queryText: query,
        resultCount: approvals.length,
        sourceIds: sourceIdsByType("approval"),
        durationMs: totalDuration,
      },
      {
        toolName: "search_quotes",
        queryText: query,
        resultCount: quotes.length,
        sourceIds: sourceIdsByType("quote"),
        durationMs: totalDuration,
      },
      {
        toolName: "search_finance",
        queryText: query,
        resultCount: finances.length,
        sourceIds: sourceIdsByType("finance"),
        durationMs: totalDuration,
      },
    ],
  };
}
