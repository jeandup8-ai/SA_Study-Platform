-- Three items off the Supabase security advisor, plus the tidy-up 0051 asked
-- for. None of these was a hole; checking first is the point.
--
-- WHAT THE ADVISOR FLAGGED, AND WHAT IT ACTUALLY MEANT.
--
--   "Public Can Execute SECURITY DEFINER Function: has_paid_access()"
--     Read the body before believing the headline. It keys entirely on
--     auth.uid(), which is NULL for anon, so an unauthenticated call returns
--     false and leaks nothing. Not an escalation. Revoked anyway, because a
--     paywall predicate has no business being callable without a session,
--     and because the next person to edit that function should not have anon
--     in their blast radius.
--
--     The useful detail: revoking from `anon` alone does nothing. EXECUTE is
--     granted to PUBLIC by default and `anon` inherits it that way, so the
--     revoke has to name PUBLIC -- which also strips `authenticated`, hence
--     the explicit grants back. Verified after applying: anon false,
--     authenticated true, service_role true.
--
--   "Function Search Path Mutable: increment_learner_points,
--    stamp_topic_video_reviewed_at"
--     Both are SECURITY INVOKER, so they already run with the caller's own
--     rights and a hijacked search_path buys an attacker nothing they did
--     not already have. Pinned for correctness, not for safety.
--
-- Deliberately not touched: pg_net living in `public`. Supabase installs it
-- there; moving it is their call to make, not ours to guess at.

revoke execute on function public.has_paid_access() from public;
revoke execute on function public.has_paid_access() from anon;
grant execute on function public.has_paid_access() to authenticated;
grant execute on function public.has_paid_access() to service_role;

alter function public.increment_learner_points set search_path to 'public';
alter function internal.stamp_topic_video_reviewed_at() set search_path to 'public';

-- --------------------------------------------------------------------------
-- STILL OUTSTANDING, BECAUSE THIS SESSION COULD NOT RUN DROP.
--
-- 1. The duplicate billing trigger that 0051 documented. Both triggers are
--    live; `guard_` is redundant and `protect_` is the stricter one that
--    actually decides the outcome. Harmless, but it means two places look
--    like they own the same rule.
--
--      drop trigger if exists subscriptions_guard_billing_fields
--        on public.subscriptions;
--      drop function if exists internal.guard_subscription_billing_fields();
--
-- 2. Test scaffolding left behind while proving 0064. It is in `internal`,
--    which is not exposed over REST, and it only returns text, but it is
--    scaffolding and should not be in production:
--
--      drop function if exists internal.tmp_test_trial_guard();
-- --------------------------------------------------------------------------
