-- is_admin() only needs to be callable by logged-in (authenticated) roles for RLS
-- policy evaluation; there is no legitimate reason for the anonymous role to invoke it
-- directly via /rest/v1/rpc/is_admin.
revoke execute on function is_admin() from public;
revoke execute on function is_admin() from anon;
grant execute on function is_admin() to authenticated;
