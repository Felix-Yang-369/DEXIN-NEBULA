-- Restrict leave usage visibility to the same scope as its source request.

begin;

drop policy if exists employee_leave_usages_select_authorized
  on public.employee_leave_usages;
create policy employee_leave_usages_select_authorized
on public.employee_leave_usages for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.can_view_leave_request(leave_request_id)
);

commit;
