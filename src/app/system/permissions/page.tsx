import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, CircleAlert, KeyRound, Plus, Search, ShieldCheck, UsersRound } from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { assignAccessRoleAction, configureAccessRoleAction, createAccessRoleAction } from "@/features/permissions/access-center-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "权限中心", description: "自定义角色、权限配置与最终权限查询" };
export const dynamic = "force-dynamic";

type Permission = { id: string; code: string; module: string; name: string; description: string | null; risk_level: string };
type Grant = { effect: string; data_scope: string; field_access: string; permission: Permission | Permission[] | null };
type AccessRole = { id: string; code: string; name: string; description: string | null; is_system: boolean; source_role_code: string | null; access_role_permissions: Grant[] };
type Employee = { id: string; name: string; employee_no: string; title: string | null };
type Assignment = { employee_id: string; role_id: string };
type EffectivePermission = { permission_code: string; permission_name: string; module: string; risk_level: string; effect: string; data_scope: string; field_access: string; source_roles: string[] };

const scopeLabels: Record<string, string> = { self: "本人", department: "本部门", department_tree: "部门树", assigned: "负责对象", organization: "全组织" };
const fieldLabels: Record<string, string> = { masked: "脱敏", read: "只读", full: "完整" };
const feedback: Record<string, string> = {
  forbidden: "当前账号无权管理权限中心。", invalid_role: "角色编码或名称格式不正确。", duplicate_role: "角色编码已经存在。",
  role_failed: "角色创建失败。", grant_failed: "权限发布失败，请检查权限项。", invalid_assignment: "员工或角色参数无效。",
  assignment_failed: "角色分配失败。",
};

function one<T>(value: T | T[] | null) { return Array.isArray(value) ? (value[0] ?? null) : value; }

export default async function PermissionCenterPage({ searchParams }: { searchParams: Promise<{ role?: string; employee?: string; saved?: string; error?: string }> }) {
  const employee = await requireCurrentEmployee();
  const canManage = employee.roleCodes.some((code) => code === "admin" || code === "chairman");
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: permissionsData }, { data: rolesData }, { data: employeesData }, { data: assignmentsData }] = canManage
    ? await Promise.all([
        supabase.from("access_permissions").select("id, code, module, name, description, risk_level").order("sort_order"),
        supabase.from("access_roles").select("id, code, name, description, is_system, source_role_code, access_role_permissions(effect, data_scope, field_access, permission:access_permissions(id, code, module, name, description, risk_level))").order("is_system", { ascending: false }).order("name"),
        supabase.from("employees").select("id, name, employee_no, title").eq("status", "active").order("name"),
        supabase.from("employee_access_roles").select("employee_id, role_id"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const permissions = (permissionsData ?? []) as Permission[];
  const accessRoles = (rolesData ?? []) as AccessRole[];
  const employees = (employeesData ?? []) as Employee[];
  const assignments = (assignmentsData ?? []) as Assignment[];
  const customRoles = accessRoles.filter((role) => !role.is_system);
  const selectedRole = accessRoles.find((role) => role.id === params.role) ?? customRoles[0] ?? accessRoles[0] ?? null;
  const selectedEmployee = employees.find((item) => item.id === params.employee) ?? employees[0] ?? null;
  const { data: effectiveData } = selectedEmployee && canManage
    ? await supabase.rpc("effective_employee_permissions", { p_employee_id: selectedEmployee.id })
    : { data: [] };
  const effective = (effectiveData ?? []) as EffectivePermission[];
  const selectedGrants = new Map((selectedRole?.access_role_permissions ?? []).map((grant) => [one(grant.permission)?.code, grant]));

  return <WorkflowShell activeItem="系统管理" breadcrumb="系统管理 / 权限中心" currentUser={{ name: employee.name, roleLabel: canManage ? "权限管理员" : "内部员工" }}>
    <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
      <section className="ui-page-header">
        <ShieldCheck className="absolute right-12 top-1/2 hidden size-36 -translate-y-1/2 text-white/[0.06] sm:block" />
        <Link className="inline-flex items-center gap-2 text-xs text-white/55 hover:text-white" href="/system"><ArrowLeft className="size-3" />系统管理</Link>
        <div className="mt-5 text-xs tracking-[0.15em] text-muted-foreground">IAM · RBAC · DATA SCOPE · EXPLAIN</div>
        <h1 className="mt-3 text-2xl font-semibold">权限中心 V2</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">配置自定义角色、操作权限与数据范围，并解释每位员工的最终有效权限。实际授权仍由服务端函数与数据库 RLS 执行。</p>
      </section>

      {!canManage ? <div className="mt-5 rounded-md border border-border bg-white p-10 text-center text-sm text-foreground">权限中心仅向系统管理员和董事长开放。</div> : <>
        {(params.error || params.saved) && <div className={`mt-5 flex items-center gap-2 rounded-md border px-4 py-3 text-xs ${params.error ? "border-border bg-muted text-foreground" : "border-border bg-muted text-foreground"}`}>
          {params.error ? <CircleAlert className="size-4" /> : <BadgeCheck className="size-4" />}{params.error ? feedback[params.error] ?? "操作失败。" : "权限配置已保存并写入审计日志。"}
        </div>}

        <section className="mt-5 grid gap-4 xl:grid-cols-[360px_1fr]" id="role-editor">
          <div className="rounded-md border border-border bg-white p-5">
            <div className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /><h2 className="text-sm font-semibold">角色目录</h2></div>
            <div className="mt-4 space-y-2">
              {accessRoles.map((role) => <Link className={`block rounded-md border px-4 py-3 ${selectedRole?.id === role.id ? "border-primary bg-muted" : "border-border bg-muted"}`} href={`/system/permissions?role=${role.id}#role-editor`} key={role.id}>
                <div className="flex items-center justify-between"><span className="text-xs font-medium">{role.name}</span><span className="text-xs text-muted-foreground">{role.is_system ? "系统" : "自定义"}</span></div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{role.code}</div>
              </Link>)}
            </div>
            <form action={createAccessRoleAction} className="mt-5 space-y-3 border-t border-border pt-5">
              <div className="flex items-center gap-2 text-xs font-semibold"><Plus className="size-4" />新建自定义角色</div>
              <input className="h-10 w-full rounded-md border border-border px-3 text-xs" name="name" placeholder="角色名称，如：应付会计" required />
              <input className="h-10 w-full rounded-md border border-border px-3 font-mono text-xs" name="code" pattern="[a-z][a-z0-9_]{2,39}" placeholder="payable_accountant" required />
              <textarea className="min-h-20 w-full rounded-md border border-border p-3 text-xs" name="description" placeholder="职责说明" />
              <button className="h-10 w-full rounded-md bg-primary text-xs text-primary-foreground" type="submit">创建角色</button>
            </form>
          </div>

          <div className="rounded-md border border-border bg-white p-5 sm:p-6">
            <h2 className="text-sm font-semibold">权限配置</h2>
            {!selectedRole ? <div className="mt-6 rounded-md bg-muted p-10 text-center text-xs text-muted-foreground">创建一个自定义角色后即可配置权限。</div> : selectedRole.is_system ? <div className="mt-6 rounded-md bg-muted p-6 text-xs leading-6 text-foreground">系统角色保持只读，用于兼容当前业务授权。需要差异化职责时，请创建自定义角色。</div> : <form action={configureAccessRoleAction} className="mt-5">
              <input name="roleId" type="hidden" value={selectedRole.id} />
              <div className="overflow-x-auto rounded-md border border-border"><table className="w-full min-w-[820px] text-left text-xs"><thead className="bg-muted text-muted-foreground"><tr><th className="p-3">启用</th><th className="p-3">权限</th><th className="p-3">效果</th><th className="p-3">数据范围</th><th className="p-3">字段</th><th className="p-3">风险</th></tr></thead><tbody>
                {permissions.map((permission) => { const grant = selectedGrants.get(permission.code); return <tr className="border-t border-border" key={permission.code}>
                  <td className="p-3"><input defaultChecked={Boolean(grant)} name="permissionCodes" type="checkbox" value={permission.code} /></td>
                  <td className="p-3"><div className="font-medium">{permission.name}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{permission.code}</div></td>
                  <td className="p-3"><select className="h-8 rounded-lg border border-border px-2" defaultValue={grant?.effect ?? "allow"} name={`effect:${permission.code}`}><option value="allow">允许</option><option value="deny">禁止</option></select></td>
                  <td className="p-3"><select className="h-8 rounded-lg border border-border px-2" defaultValue={grant?.data_scope ?? "organization"} name={`scope:${permission.code}`}>{Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
                  <td className="p-3"><select className="h-8 rounded-lg border border-border px-2" defaultValue={grant?.field_access ?? "full"} name={`field:${permission.code}`}>{Object.entries(fieldLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
                  <td className="p-3"><span className={permission.risk_level === "high" ? "text-foreground" : "text-muted-foreground"}>{permission.risk_level === "high" ? "高风险" : permission.risk_level === "sensitive" ? "敏感" : "一般"}</span></td>
                </tr>; })}
              </tbody></table></div>
              <button className="mt-4 h-10 rounded-md bg-primary px-5 text-xs text-primary-foreground" type="submit">发布权限配置</button>
            </form>}
          </div>
        </section>

        <section className="mt-5 rounded-md border border-border bg-white p-5 sm:p-6" id="assignments">
          <div className="flex items-center gap-2"><UsersRound className="size-4 text-primary" /><h2 className="text-sm font-semibold">自定义角色成员</h2></div>
          {!customRoles.length ? <p className="mt-4 text-xs text-muted-foreground">暂无自定义角色。</p> : <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{employees.map((target) => <div className="rounded-md border border-border bg-muted p-4" key={target.id}>
            <div className="text-xs font-medium">{target.name}</div><div className="mt-1 text-xs text-muted-foreground">{target.employee_no} · {target.title ?? "未设置职位"}</div>
            <div className="mt-3 flex flex-wrap gap-2">{customRoles.map((role) => { const assigned = assignments.some((row) => row.employee_id === target.id && row.role_id === role.id); return <form action={assignAccessRoleAction} key={role.id}>
              <input name="employeeId" type="hidden" value={target.id} /><input name="roleId" type="hidden" value={role.id} /><input name="assigned" type="hidden" value={assigned ? "false" : "true"} />
              <button className={`rounded-md border px-3 py-1.5 text-xs ${assigned ? "border-border bg-muted text-foreground" : "border-border bg-white text-muted-foreground"}`} type="submit">{assigned ? "✓ " : "+ "}{role.name}</button>
            </form>; })}</div>
          </div>)}</div>}
        </section>

        <section className="mt-5 rounded-md border border-border bg-white p-5 sm:p-6" id="effective-access">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Search className="size-4 text-primary" /><h2 className="text-sm font-semibold">最终权限查询</h2></div>
            <form><select className="h-10 min-w-56 rounded-md border border-border px-3 text-xs" defaultValue={selectedEmployee?.id} name="employee">{employees.map((target) => <option key={target.id} value={target.id}>{target.name} · {target.employee_no}</option>)}</select><button className="ml-2 h-10 rounded-md border border-border px-4 text-xs" type="submit">查询</button></form></div>
          <div className="mt-4 overflow-x-auto rounded-md border border-border"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-muted text-muted-foreground"><tr><th className="p-3">权限</th><th className="p-3">结果</th><th className="p-3">数据范围</th><th className="p-3">字段</th><th className="p-3">来源角色</th></tr></thead><tbody>
            {effective.map((row) => <tr className="border-t border-border" key={row.permission_code}><td className="p-3"><div className="font-medium">{row.permission_name}</div><div className="font-mono text-xs text-muted-foreground">{row.permission_code}</div></td><td className={`p-3 ${row.effect === "deny" ? "text-foreground" : "text-foreground"}`}>{row.effect === "deny" ? "禁止" : "允许"}</td><td className="p-3">{scopeLabels[row.data_scope] ?? row.data_scope}</td><td className="p-3">{fieldLabels[row.field_access] ?? row.field_access}</td><td className="p-3">{row.source_roles.join("、")}</td></tr>)}
            {!effective.length && <tr><td className="p-8 text-center text-muted-foreground" colSpan={5}>该员工尚无已配置的有效权限。</td></tr>}
          </tbody></table></div>
        </section>
      </>}
    </main>
  </WorkflowShell>;
}
