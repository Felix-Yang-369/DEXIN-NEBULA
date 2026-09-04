"use client";
import { useRef } from "react";
import { submitConfigurableFormAction } from "@/features/experience/actions";
export type DynamicField = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "checkbox";
  required?: boolean;
  options?: string[];
};
export function DynamicForm({
  formId,
  fields,
}: {
  formId: string;
  fields: DynamicField[];
}) {
  const payload = useRef<HTMLInputElement>(null);
  return (
    <form
      action={submitConfigurableFormAction}
      className="grid gap-4"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const value = Object.fromEntries(
          fields.map((field) => [
            field.key,
            field.type === "checkbox"
              ? data.get(field.key) === "on"
              : data.get(field.key),
          ]),
        );
        if (payload.current) payload.current.value = JSON.stringify(value);
      }}
    >
      <input name="formId" type="hidden" value={formId} />
      <input name="payload" ref={payload} type="hidden" />
      {fields.map((field) => (
        <label className="text-[11px] text-[#526b7d]" key={field.key}>
          {field.label}
          {field.required && <span className="ml-1 text-red-500">*</span>}
          {field.type === "textarea" ? (
            <textarea
              className="mt-1 min-h-28 w-full rounded-xl border border-border p-3 text-xs"
              name={field.key}
              required={field.required}
            />
          ) : field.type === "select" ? (
            <select
              className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs"
              name={field.key}
              required={field.required}
            >
              <option value="">请选择</option>
              {field.options?.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          ) : field.type === "checkbox" ? (
            <input className="ml-3" name={field.key} type="checkbox" />
          ) : (
            <input
              className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-xs"
              name={field.key}
              required={field.required}
              type={field.type}
            />
          )}
        </label>
      ))}
      <button className="h-10 rounded-xl bg-primary text-xs font-medium text-white">
        提交表单
      </button>
    </form>
  );
}
