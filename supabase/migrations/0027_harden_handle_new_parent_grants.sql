-- handle_new_parent() is a trigger function (fires on insert into auth.users) and has
-- no legitimate direct caller: it takes no arguments and blindly inserts a parent row
-- for whatever `new` row the trigger passes it. Left at the default grants, Postgres
-- lets `anon`/`authenticated` call it directly via PostgREST as `/rest/v1/rpc/handle_new_parent`,
-- which does nothing useful (there's no `new` trigger record outside a trigger context)
-- but is needless API surface flagged by the security advisor.
--
-- Revoking EXECUTE here does not affect the trigger itself: firing a trigger doesn't
-- require the triggering session to hold EXECUTE on the trigger function, only that the
-- function owner (a SECURITY DEFINER function runs as its owner) has the privileges the
-- function body needs -- which is exactly the pattern already used for is_admin() in
-- migration 0006.
revoke execute on function handle_new_parent() from public;
revoke execute on function handle_new_parent() from anon;
revoke execute on function handle_new_parent() from authenticated;
