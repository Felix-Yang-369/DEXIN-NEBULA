-- Remove duplicated permissive SELECT checks from inventory import and batch
-- hot paths while preserving the existing read and write authorization rules.
begin;

drop policy if exists "inventory imports visible to inventory readers"
  on public.inventory_imports;
drop policy if exists "inventory imports manageable by inventory operators"
  on public.inventory_imports;

create policy "inventory imports visible to inventory readers"
on public.inventory_imports for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.current_employee_id()) is not null
);
create policy "inventory imports insert by inventory operators"
on public.inventory_imports for insert to authenticated
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
);
create policy "inventory imports update by inventory operators"
on public.inventory_imports for update to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
)
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
);
create policy "inventory imports delete by inventory operators"
on public.inventory_imports for delete to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
);

drop policy if exists "inventory batches visible to active employees"
  on public.inventory_batches;
drop policy if exists "inventory batches manageable by inventory operators"
  on public.inventory_batches;

create policy "inventory batches visible to active employees"
on public.inventory_batches for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.current_employee_id()) is not null
);
create policy "inventory batches insert by inventory operators"
on public.inventory_batches for insert to authenticated
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
);
create policy "inventory batches update by inventory operators"
on public.inventory_batches for update to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
)
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
);
create policy "inventory batches delete by inventory operators"
on public.inventory_batches for delete to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
);

commit;
