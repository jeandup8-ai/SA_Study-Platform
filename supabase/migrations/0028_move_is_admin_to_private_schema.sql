-- is_admin() cannot have EXECUTE revoked from `authenticated`: it's called inside ~20
-- RLS policies (skills, terminology, admin tables, assessment_notes, the expanded
-- taxonomy tables, ...), and Postgres requires the querying role to hold EXECUTE on any
-- function an RLS policy calls. It also can't become SECURITY INVOKER: the admins
-- table's own select policy is `using (id = auth.uid() or is_admin())`, so a
-- SECURITY INVOKER is_admin() would re-trigger that same policy while evaluating it --
-- infinite recursion. SECURITY DEFINER + authenticated-EXECUTE is required.
--
-- What *is* fixable is the advisor's actual complaint: that this SECURITY DEFINER
-- function is directly reachable as /rest/v1/rpc/is_admin. Supabase's own guidance for
-- this (see "Securing your API" -> "Use a dedicated API schema") is to keep helper
-- functions like this in a schema the Data API doesn't expose (default exposed schema
-- is just `public`). Moving it there removes the RPC route entirely, while every
-- existing RLS policy that calls is_admin() keeps working unchanged: Postgres resolves
-- the function by its OID once a policy is created, not by re-parsing the bare name on
-- each row check, so relocating the object doesn't require touching any policy.
create schema if not exists internal;

grant usage on schema internal to authenticated;

alter function public.is_admin() set schema internal;
