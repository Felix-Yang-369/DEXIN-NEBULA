export const knowledgeCategories = {
  culture: {
    label: "企业文化",
    eyebrow: "CULTURE",
    tone: "bg-[#eaf3f8] text-[#0d6c78]",
  },
  conduct: {
    label: "行为规范",
    eyebrow: "CONDUCT",
    tone: "bg-[#f8eeee] text-[#965151]",
  },
  administration: {
    label: "行政管理",
    eyebrow: "ADMIN",
    tone: "bg-[#edf2f7] text-[#42647a]",
  },
  attendance: {
    label: "考勤休假",
    eyebrow: "ATTENDANCE",
    tone: "bg-[#fff4e7] text-[#9a6321]",
  },
  reporting: {
    label: "汇报会议",
    eyebrow: "REPORTING",
    tone: "bg-[#f3eef8] text-[#77518e]",
  },
  organization: {
    label: "组织岗位",
    eyebrow: "ORGANIZATION",
    tone: "bg-[#eef5f5] text-[#397076]",
  },
} as const;

export type KnowledgeCategory = keyof typeof knowledgeCategories;

export type KnowledgeDocument = {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  category_code: KnowledgeCategory;
  summary: string;
  content: string;
  keywords: string[];
  owner_label: string | null;
  source_file_name: string | null;
  version: string;
  effective_on: string | null;
  published_at: string | null;
  updated_at: string;
};

export function isKnowledgeCategory(
  value: string | undefined,
): value is KnowledgeCategory {
  return Boolean(value && value in knowledgeCategories);
}
