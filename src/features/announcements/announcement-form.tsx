"use client";

import { useActionState } from "react";
import { Save, Send } from "lucide-react";
import {
  saveAnnouncementAction,
  type AnnouncementActionState,
} from "./server-actions";
import type { AnnouncementRow } from "./announcement-data";

const initialState: AnnouncementActionState = { error: "" };

export function AnnouncementForm({
  departments,
  draft,
}: {
  departments: Array<{ id: string; name: string }>;
  draft: AnnouncementRow | null;
}) {
  const [state, formAction, pending] = useActionState(
    saveAnnouncementAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input name="announcementId" type="hidden" value={draft?.id ?? ""} />

      <div className="grid gap-5 lg:grid-cols-2">
        <label className="block lg:col-span-2">
          <span className="text-xs font-semibold text-foreground">公告标题</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-border bg-white px-4 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            defaultValue={draft?.title}
            disabled={pending}
            maxLength={120}
            name="title"
            placeholder="清晰说明公告主题"
            required
          />
        </label>

        <label className="block lg:col-span-2">
          <span className="text-xs font-semibold text-foreground">公告摘要</span>
          <textarea
            className="mt-2 min-h-24 w-full resize-y rounded-md border border-border bg-white px-4 py-3 text-xs leading-6 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            defaultValue={draft?.summary}
            disabled={pending}
            maxLength={300}
            name="summary"
            placeholder="用于公告列表和站内通知，建议一至两句话"
            required
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-foreground">公告分类</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-xs outline-none focus:border-primary/35"
            defaultValue={draft?.category_code ?? "company"}
            disabled={pending}
            name="categoryCode"
          >
            <option value="company">公司通知</option>
            <option value="policy">制度提醒</option>
            <option value="project">项目动态</option>
            <option value="operations">经营运营</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-foreground">可见范围</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-xs outline-none focus:border-primary/35"
            defaultValue={draft?.scope_type ?? "all"}
            disabled={pending}
            name="scopeType"
          >
            <option value="all">全体员工</option>
            <option value="department">指定部门</option>
          </select>
        </label>

        <label className="block lg:col-span-2">
          <span className="text-xs font-semibold text-foreground">
            指定部门
          </span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-xs outline-none focus:border-primary/35"
            defaultValue={draft?.scope_department_id ?? ""}
            disabled={pending}
            name="scopeDepartmentId"
          >
            <option value="">全员公告无需选择；部门公告请选择</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block lg:col-span-2">
          <span className="text-xs font-semibold text-foreground">公告正文</span>
          <textarea
            className="mt-2 min-h-72 w-full resize-y rounded-md border border-border bg-white px-4 py-3 text-xs leading-7 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            defaultValue={draft?.content}
            disabled={pending}
            maxLength={20000}
            name="content"
            placeholder={"请完整填写公告内容。\n\n可使用空行分隔段落。"}
            required
          />
        </label>
      </div>

      <label className="flex items-center gap-3 rounded-md border border-border bg-muted px-4 py-3">
        <input
          defaultChecked={draft?.is_pinned}
          disabled={pending}
          name="isPinned"
          type="checkbox"
        />
        <span>
          <span className="block text-xs font-medium">发布后置顶</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            仅用于需要员工优先关注的重要公告。
          </span>
        </span>
      </label>

      {state.error && (
        <div
          className="rounded-md border border-border bg-muted px-4 py-3 text-xs text-foreground"
          role="alert"
        >
          {state.error}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted-foreground">
          草稿不会通知员工；正式发布后将按可见范围发送站内通知并写入审计日志。
        </p>
        <div className="flex gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-4 text-xs font-medium text-muted-foreground disabled:opacity-50"
            disabled={pending}
            name="intent"
            type="submit"
            value="draft"
          >
            <Save className="size-3.5" />
            保存草稿
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-xs font-medium text-white disabled:opacity-50"
            disabled={pending}
            name="intent"
            type="submit"
            value="publish"
          >
            <Send className="size-3.5" />
            正式发布
          </button>
        </div>
      </div>
    </form>
  );
}
