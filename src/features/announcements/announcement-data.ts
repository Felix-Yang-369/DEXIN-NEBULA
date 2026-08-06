export const announcementCategories = {
  company: {
    label: "公司通知",
    tone: "bg-[#eaf3f8] text-[#0d6c78]",
  },
  policy: {
    label: "制度提醒",
    tone: "bg-[#fff4e7] text-[#9a6321]",
  },
  project: {
    label: "项目动态",
    tone: "bg-[#edf2f7] text-[#42647a]",
  },
  operations: {
    label: "经营运营",
    tone: "bg-[#f3eef8] text-[#77518e]",
  },
} as const;

export type AnnouncementCategory = keyof typeof announcementCategories;

export type AnnouncementRow = {
  id: string;
  title: string;
  summary: string;
  content: string;
  category_code: AnnouncementCategory;
  scope_type: "all" | "department";
  scope_department_id: string | null;
  status: "draft" | "published" | "archived";
  is_pinned: boolean;
  author_employee_id: string;
  author_name: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  scopeDepartment?: { name: string } | Array<{ name: string }> | null;
};
