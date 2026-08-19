-- Bug fix: the client was inserting into `parents` immediately after
-- auth.signUp(), but if the project requires email confirmation (the default),
-- there is no active session yet at that point — the insert runs unauthenticated
-- and is correctly rejected by RLS (`parents_insert_self` requires
-- id = auth.uid()), which surfaced to users as a generic "Something went wrong"
-- on sign-up.
--
-- Fix: create the parent row from a trigger on auth.users instead, running with
-- elevated privileges server-side. This works regardless of whether email
-- confirmation is required, and removes the client's dependency on having an
-- active session at the exact moment of sign-up.

create or replace function handle_new_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into parents (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_parent();
