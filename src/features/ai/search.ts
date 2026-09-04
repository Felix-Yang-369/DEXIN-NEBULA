const STOP_TERMS = new Set([
  "什么",
  "怎么",
  "如何",
  "一下",
  "请问",
  "是否",
  "可以",
  "需要",
  "哪些",
  "多少",
  "告诉",
  "查询",
  "查看",
  "查找",
  "帮我",
  "公司",
  "内部",
  "关于",
  "最新",
  "资料",
]);

const DOMAIN_TERMS = [
  "制度",
  "规定",
  "流程",
  "产品",
  "商品",
  "价格",
  "库存",
  "仓库",
  "客户",
  "供应商",
  "员工",
  "部门",
  "公告",
  "通知",
  "文件",
  "文档",
  "审批",
  "申请",
  "报价",
  "财务",
  "应收",
  "应付",
];

export function extractSearchTerms(input: string) {
  const normalized = input
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/\s+/g, " ")
    .trim();
  const terms = new Set<string>();

  for (const match of normalized.matchAll(/[a-z0-9][a-z0-9_-]{1,}/g)) {
    terms.add(match[0]);
  }
  for (const match of normalized.matchAll(/[\u3400-\u9fff]{2,}/g)) {
    const value = match[0];
    if (value.length <= 6 && !STOP_TERMS.has(value)) terms.add(value);
    for (let size = 4; size >= 2; size -= 1) {
      for (let index = 0; index <= value.length - size; index += 1) {
        const term = value.slice(index, index + size);
        if (!STOP_TERMS.has(term)) terms.add(term);
      }
    }
  }

  return [...terms].slice(0, 36);
}

export function selectRetrievalTerm(input: string, terms = extractSearchTerms(input)) {
  let cleaned = input.normalize("NFKC").toLocaleLowerCase("zh-CN");
  for (const term of [...DOMAIN_TERMS, ...STOP_TERMS].sort(
    (left, right) => right.length - left.length,
  )) {
    cleaned = cleaned.replaceAll(term, " ");
  }
  cleaned = cleaned
    .replace(/[的了吗呢啊与和及以]/g, " ")
    .replace(/[^\p{L}\p{N}_\-/.@]+/gu, " ")
    .trim();
  const candidates =
    cleaned.match(/[a-z0-9][a-z0-9_\-/.@]{1,}|[\u3400-\u9fff]{2,}/g) ?? [];
  const direct = [...new Set(candidates)].sort(
    (left, right) => right.length - left.length || left.localeCompare(right),
  );
  if (direct[0]) return direct[0].slice(0, 24);

  const fallback = [...terms].sort(
    (left, right) => right.length - left.length || left.localeCompare(right),
  );
  return (
    fallback.find(
      (term) => !DOMAIN_TERMS.some((domainTerm) => term.includes(domainTerm)),
    ) ?? fallback[0] ?? ""
  );
}

export function searchableText(values: unknown[]) {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .join(" ")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN");
}

export function relevanceScore(text: string, terms: string[]) {
  return terms.reduce((score, term) => {
    if (!text.includes(term)) return score;
    return score + Math.min(term.length, 6);
  }, 0);
}

export function classifyAiQuery(input: string) {
  const normalized = input.normalize("NFKC").toLocaleLowerCase("zh-CN");
  const productCode =
    normalized.match(/\bdx-[a-z0-9_-]+\b/i)?.[0]?.toUpperCase() ?? null;
  const knowledge = /(制度|规定|流程|请假|考勤|报销|用印|审批|周报|合同)/.test(
    normalized,
  );
  const inventory = /(库存|仓库|万纬|可用|缺货|效期|批次|库位)/.test(
    normalized,
  );
  const product =
    Boolean(productCode) ||
    /(产品|商品|规格|价格|团购|代发|配送|品牌|条码|起订)/.test(normalized);
  const customer = /(客户|crm|联系人|跟进|拜访|客户等级|负责客户)/.test(
    normalized,
  );
  const supplier = /(供应商|srm|供货|采购来源|供应商资质|结算条款)/.test(
    normalized,
  );
  const employee = /(员工|同事|人员|通讯录|部门|岗位|负责人|入职)/.test(
    normalized,
  );
  const announcement = /(公告|通知|公司消息|最新消息)/.test(normalized);
  const document = /(文件|文档|资料|附件|客户文件|供应商资质)/.test(
    normalized,
  );
  const approval = /(待审批|我的申请|申请进度|审批状态|报销进度|用印进度)/.test(
    normalized,
  );
  const quote = /(报价|报价单|报价金额|有效期)/.test(normalized);
  const finance = /(财务|应收|应付|回款|付款|核销|账龄|凭证|发票|欠款|余额)/.test(
    normalized,
  );
  const hasExplicitIntent =
    knowledge ||
    inventory ||
    product ||
    customer ||
    supplier ||
    employee ||
    announcement ||
    document ||
    approval ||
    quote ||
    finance;

  return {
    knowledge: hasExplicitIntent ? knowledge : true,
    product: hasExplicitIntent ? product && (!inventory || Boolean(productCode)) : true,
    inventory: hasExplicitIntent ? inventory : true,
    customer: hasExplicitIntent ? customer : true,
    supplier: hasExplicitIntent ? supplier : true,
    employee: hasExplicitIntent ? employee : true,
    announcement: hasExplicitIntent ? announcement : true,
    document: hasExplicitIntent ? document : true,
    approval: hasExplicitIntent ? approval : true,
    quote: hasExplicitIntent ? quote : true,
    finance: hasExplicitIntent ? finance : true,
    hasExplicitIntent,
    productCode,
  };
}
