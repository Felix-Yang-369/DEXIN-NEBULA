export function normalizeSearchQuery(input: string, maxLength = 80) {
  return input
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function postgrestContainsFilter(fields: string[], input: string) {
  const value = normalizeSearchQuery(input)
    // `.or()` uses PostgREST's raw filter grammar. Keep user input out of its
    // separators and wildcard operators while preserving Chinese and codes.
    .replace(/[^\p{L}\p{N}\s\-/.@]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!value || fields.length === 0) return null;
  return fields.map((field) => `${field}.ilike.%${value}%`).join(",");
}

export type SearchDomains = {
  employee: boolean;
  knowledge: boolean;
  product: boolean;
  customer: boolean;
  supplier: boolean;
  salesOrder: boolean;
  purchaseOrder: boolean;
  approval: boolean;
  finance: boolean;
  announcement: boolean;
  document: boolean;
  hasExplicitDomain: boolean;
};

export function classifySearchDomains(input: string): SearchDomains {
  const query = normalizeSearchQuery(input).toLocaleLowerCase("zh-CN");
  const matches = {
    employee: /(员工|同事|人员|通讯录|部门|岗位|负责人|工号)/.test(query),
    knowledge: /(制度|规定|流程|请假|考勤|周报|报销规则)/.test(query),
    product: /(产品|商品|大米|食用油|礼盒|规格|品牌|条码|价格|\bdx-[a-z0-9_-]+\b)/i.test(query),
    customer: /(客户|crm|联系人|跟进|拜访|客户等级)/.test(query),
    supplier: /(供应商|srm|供货|供应商资质|结算条款)/.test(query),
    salesOrder: /(销售订单|销售单|销售|\bso[-_a-z0-9]*\b)/i.test(query),
    purchaseOrder: /(采购订单|采购单|采购|\bpo[-_a-z0-9]*\b)/i.test(query),
    approval: /(审批|申请进度|待审|报销进度|用印进度)/.test(query),
    finance: /(财务|应收|应付|回款|付款|核销|账龄|凭证|发票|欠款|余额)/.test(query),
    announcement: /(公告|通知|公司消息|最新消息)/.test(query),
    document: /(文件|文档|资料|附件|合同文件)/.test(query),
  };
  const hasExplicitDomain = Object.values(matches).some(Boolean);

  return {
    ...Object.fromEntries(
      Object.entries(matches).map(([key, value]) => [
        key,
        hasExplicitDomain ? value : true,
      ]),
    ) as Omit<SearchDomains, "hasExplicitDomain">,
    hasExplicitDomain,
  };
}

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .trim();
}

export function searchResultScore(
  input: string,
  values: unknown[],
  identifierValues: unknown[] = [],
) {
  const query = normalized(input);
  if (!query) return 0;

  const identifiers = identifierValues.map(normalized).filter(Boolean);
  if (identifiers.some((value) => value === query)) return 100;
  if (identifiers.some((value) => value.startsWith(query))) return 80;

  const searchable = values.map(normalized).filter(Boolean);
  if (searchable.some((value) => value === query)) return 70;
  if (searchable.some((value) => value.startsWith(query))) return 55;
  if (searchable.some((value) => value.includes(query))) return 35;
  return 0;
}

export function rankSearchResults<T>(
  rows: T[],
  input: string,
  values: (row: T) => unknown[],
  identifiers: (row: T) => unknown[] = () => [],
  limit = 5,
) {
  return rows
    .map((row, index) => ({
      row,
      index,
      score: searchResultScore(input, values(row), identifiers(row)),
    }))
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.index - right.index,
    )
    .slice(0, limit)
    .map((item) => item.row);
}
