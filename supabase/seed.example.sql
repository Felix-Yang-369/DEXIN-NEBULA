-- Run the migration first, then create internal users in Supabase Auth.
-- Replace every placeholder before running this file in a development project.
-- Never commit real employee UUIDs, emails or passwords.

begin;

with organization as (
  insert into public.organizations (name, slug)
  values ('德馨淼盛', 'dexin-miaosheng')
  returning id
)
insert into public.departments (organization_id, name, code)
select id, department.name, department.code
from organization
cross join (
  values
    ('管理层', 'DX-MGT'),
    ('销售部', 'DX-SALES'),
    ('采购部', 'DX-PROC'),
    ('客服部', 'DX-CS'),
    ('仓储部', 'DX-WH'),
    ('财务部', 'DX-FIN'),
    ('行政人事', 'DX-HR')
) as department(name, code);

insert into public.roles (organization_id, code, name)
select
  organization.id,
  role.code,
  role.name
from public.organizations organization
cross join (
  values
    ('employee', '普通员工'),
    ('department_lead', '部门负责人'),
    ('hr', '人事行政'),
    ('finance', '财务'),
    ('admin', '系统管理员'),
    ('chairman', '董事长')
) as role(code, name)
where organization.slug = 'dexin-miaosheng'
on conflict (organization_id, code) do nothing;

-- Example after creating the corresponding user in Supabase Auth:
--
-- insert into public.employees (
--   organization_id,
--   department_id,
--   auth_user_id,
--   employee_no,
--   name,
--   email,
--   title
-- )
-- select
--   organization.id,
--   department.id,
--   'REPLACE_WITH_AUTH_USER_UUID'::uuid,
--   'DX0001',
--   '示例管理员',
--   'admin@example.com',
--   '系统管理员'
-- from public.organizations organization
-- join public.departments department
--   on department.organization_id = organization.id
--  and department.code = 'DX-MGT'
-- where organization.slug = 'dexin-miaosheng';

commit;
