-- Trigger-only functions must not be callable through the Data API.

begin;

revoke all on function public.finalize_period_reopening()
from public, anon, authenticated;

commit;
