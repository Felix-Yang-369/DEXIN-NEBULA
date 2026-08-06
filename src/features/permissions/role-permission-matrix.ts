export type RoleId =
  | "employee"
  | "department_lead"
  | "hr"
  | "finance"
  | "admin";

export type PermissionLevel =
  | "full"
  | "department"
  | "self"
  | "limited"
  | "configure"
  | "none";

export type PermissionCell = {
  level: PermissionLevel;
  label: string;
};

export type PermissionRow = {
  name: string;
  description: string;
  permissions: Record<RoleId, PermissionCell>;
};

export const roles: Array<{
  id: RoleId;
  name: string;
  code: string;
  summary: string;
  dataScope: string;
  accent: string;
  mark: string;
}> = [
  {
    id: "employee",
    name: "普通员工",
    code: "EMPLOYEE",
    summary: "完成个人办公事务，查看本人信息和公司公开内容。",
    dataScope: "本人数据",
    accent: "bg-[#eaf3f8] text-[#0d6c78]",
    mark: "员",
  },
  {
    id: "department_lead",
    name: "部门负责人",
    code: "DEPARTMENT_LEAD",
    summary: "处理本部门审批，掌握团队基础信息与工作进度。",
    dataScope: "所属部门",
    accent: "bg-[#edf2f7] text-[#42647a]",
    mark: "负",
  },
  {
    id: "hr",
    name: "人事行政",
    code: "HR_ADMIN",
    summary: "维护组织、员工档案、合同、假期与行政制度。",
    dataScope: "全公司人事",
    accent: "bg-[#f3eef8] text-[#77518e]",
    mark: "人",
  },
  {
    id: "finance",
    name: "财务",
    code: "FINANCE",
    summary: "处理费用、报销和付款资料，查看授权财务数据。",
    dataScope: "全公司财务",
    accent: "bg-[#fff4e7] text-[#9a6321]",
    mark: "财",
  },
  {
    id: "admin",
    name: "系统管理员",
    code: "SYSTEM_ADMIN",
    summary: "维护账号、角色、流程与系统配置，不默认读取敏感业务数据。",
    dataScope: "系统配置",
    accent: "bg-[#f8eeee] text-[#965151]",
    mark: "管",
  },
];

export const pagePermissionRows: PermissionRow[] = [
  {
    name: "工作台",
    description: "个人待办、公告与快捷入口",
    permissions: {
      employee: { level: "self", label: "本人" },
      department_lead: { level: "department", label: "本部门" },
      hr: { level: "limited", label: "人事视图" },
      finance: { level: "limited", label: "财务视图" },
      admin: { level: "configure", label: "系统视图" },
    },
  },
  {
    name: "公告与制度",
    description: "公司通知、制度与知识库",
    permissions: {
      employee: { level: "limited", label: "公开内容" },
      department_lead: { level: "department", label: "部门内容" },
      hr: { level: "full", label: "发布管理" },
      finance: { level: "limited", label: "公开内容" },
      admin: { level: "configure", label: "栏目配置" },
    },
  },
  {
    name: "周报管理",
    description: "个人周报、团队提交与历史记录",
    permissions: {
      employee: { level: "self", label: "本人周报" },
      department_lead: { level: "department", label: "直属团队" },
      hr: { level: "full", label: "全公司已提交" },
      finance: { level: "self", label: "本人周报" },
      admin: { level: "configure", label: "全公司已提交" },
    },
  },
  {
    name: "申请与审批",
    description: "请假、报销、采购等统一流程",
    permissions: {
      employee: { level: "self", label: "本人申请" },
      department_lead: { level: "department", label: "部门审批" },
      hr: { level: "limited", label: "人事流程" },
      finance: { level: "limited", label: "财务流程" },
      admin: { level: "configure", label: "流程配置" },
    },
  },
  {
    name: "组织通讯录",
    description: "部门、职位与员工基础信息",
    permissions: {
      employee: { level: "limited", label: "基础信息" },
      department_lead: { level: "department", label: "本部门" },
      hr: { level: "full", label: "全公司" },
      finance: { level: "limited", label: "基础信息" },
      admin: { level: "configure", label: "组织配置" },
    },
  },
  {
    name: "员工档案",
    description: "任职、合同、假期与敏感字段",
    permissions: {
      employee: { level: "self", label: "本人档案" },
      department_lead: { level: "department", label: "部门摘要" },
      hr: { level: "full", label: "全公司" },
      finance: { level: "limited", label: "必要字段" },
      admin: { level: "limited", label: "账号字段" },
    },
  },
  {
    name: "财务中心",
    description: "费用、付款与财务分析",
    permissions: {
      employee: { level: "self", label: "本人费用" },
      department_lead: { level: "department", label: "部门费用" },
      hr: { level: "limited", label: "行政费用" },
      finance: { level: "full", label: "全公司" },
      admin: { level: "none", label: "默认不可见" },
    },
  },
  {
    name: "文件中心",
    description: "合同、客户文件、供应商资质和内部资料",
    permissions: {
      employee: { level: "limited", label: "授权文件" },
      department_lead: { level: "department", label: "部门文件" },
      hr: { level: "limited", label: "合同与人事" },
      finance: { level: "limited", label: "合同与财务" },
      admin: { level: "configure", label: "权限管理" },
    },
  },
  {
    name: "系统设置",
    description: "账号、角色、权限与审计",
    permissions: {
      employee: { level: "none", label: "不可访问" },
      department_lead: { level: "none", label: "不可访问" },
      hr: { level: "limited", label: "组织维护" },
      finance: { level: "none", label: "不可访问" },
      admin: { level: "configure", label: "全局配置" },
    },
  },
];

export const operationPermissionRows: PermissionRow[] = [
  {
    name: "查看",
    description: "读取页面和记录",
    permissions: {
      employee: { level: "self", label: "本人" },
      department_lead: { level: "department", label: "本部门" },
      hr: { level: "full", label: "人事全量" },
      finance: { level: "full", label: "财务全量" },
      admin: { level: "configure", label: "配置数据" },
    },
  },
  {
    name: "新建 / 提交",
    description: "创建申请或业务记录",
    permissions: {
      employee: { level: "self", label: "本人业务" },
      department_lead: { level: "self", label: "本人业务" },
      hr: { level: "limited", label: "人事行政" },
      finance: { level: "limited", label: "财务单据" },
      admin: { level: "configure", label: "系统配置" },
    },
  },
  {
    name: "编辑",
    description: "修改草稿或主数据",
    permissions: {
      employee: { level: "self", label: "本人草稿" },
      department_lead: { level: "department", label: "部门非敏感" },
      hr: { level: "full", label: "员工与组织" },
      finance: { level: "full", label: "财务单据" },
      admin: { level: "configure", label: "系统配置" },
    },
  },
  {
    name: "审批",
    description: "同意、退回或驳回",
    permissions: {
      employee: { level: "none", label: "无" },
      department_lead: { level: "department", label: "分配待办" },
      hr: { level: "limited", label: "人事节点" },
      finance: { level: "limited", label: "财务节点" },
      admin: { level: "none", label: "不参与业务" },
    },
  },
  {
    name: "导出",
    description: "下载列表、报表或附件",
    permissions: {
      employee: { level: "self", label: "本人记录" },
      department_lead: { level: "limited", label: "部门脱敏" },
      hr: { level: "limited", label: "授权导出" },
      finance: { level: "full", label: "财务导出" },
      admin: { level: "limited", label: "审计日志" },
    },
  },
  {
    name: "归档 / 删除",
    description: "改变记录可用状态",
    permissions: {
      employee: { level: "none", label: "无" },
      department_lead: { level: "none", label: "无" },
      hr: { level: "limited", label: "人事归档" },
      finance: { level: "limited", label: "财务归档" },
      admin: { level: "configure", label: "配置归档" },
    },
  },
  {
    name: "权限配置",
    description: "角色授权与数据范围",
    permissions: {
      employee: { level: "none", label: "无" },
      department_lead: { level: "none", label: "无" },
      hr: { level: "none", label: "无" },
      finance: { level: "none", label: "无" },
      admin: { level: "configure", label: "可配置" },
    },
  },
];

export const sensitiveFieldRows: PermissionRow[] = [
  {
    name: "身份证号",
    description: "员工身份识别信息",
    permissions: {
      employee: { level: "self", label: "本人完整" },
      department_lead: { level: "none", label: "不可见" },
      hr: { level: "full", label: "完整" },
      finance: { level: "none", label: "不可见" },
      admin: { level: "limited", label: "仅脱敏" },
    },
  },
  {
    name: "银行卡号",
    description: "工资与费用付款账户",
    permissions: {
      employee: { level: "self", label: "本人脱敏" },
      department_lead: { level: "none", label: "不可见" },
      hr: { level: "limited", label: "仅脱敏" },
      finance: { level: "full", label: "付款使用" },
      admin: { level: "none", label: "不可见" },
    },
  },
  {
    name: "工资信息",
    description: "薪资、奖金与个税",
    permissions: {
      employee: { level: "self", label: "本人" },
      department_lead: { level: "none", label: "默认不可见" },
      hr: { level: "limited", label: "单独授权" },
      finance: { level: "full", label: "核算使用" },
      admin: { level: "none", label: "不可见" },
    },
  },
  {
    name: "员工合同",
    description: "劳动合同及附件",
    permissions: {
      employee: { level: "self", label: "本人" },
      department_lead: { level: "none", label: "不可见" },
      hr: { level: "full", label: "完整" },
      finance: { level: "none", label: "不可见" },
      admin: { level: "none", label: "不可见" },
    },
  },
  {
    name: "报销附件",
    description: "发票、支付和费用证明",
    permissions: {
      employee: { level: "self", label: "本人" },
      department_lead: { level: "department", label: "审批相关" },
      hr: { level: "limited", label: "行政相关" },
      finance: { level: "full", label: "完整" },
      admin: { level: "none", label: "不可见" },
    },
  },
];

export const permissionLegend: Array<{
  level: PermissionLevel;
  label: string;
}> = [
  { level: "full", label: "完整权限" },
  { level: "department", label: "部门范围" },
  { level: "self", label: "本人范围" },
  { level: "limited", label: "受限权限" },
  { level: "configure", label: "配置权限" },
  { level: "none", label: "无权限" },
];
