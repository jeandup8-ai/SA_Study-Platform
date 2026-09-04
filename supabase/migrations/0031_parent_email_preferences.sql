-- Email preferences for the weekly parent digest (see
-- supabase/functions/weekly-parent-digest). Two ways to opt out, because a
-- parent who wants out should never be forced to log in to achieve it:
--   1. In-app toggle (Parent -> Settings), which writes weekly_digest_enabled.
--   2. A one-click unsubscribe link in every digest email, keyed by
--      unsubscribe_token -- an opaque per-parent value, so the link works
--      without a session and reveals nothing about the account.
--
-- The token is deliberately separate from the parent's id: id appears in
-- ordinary app traffic, whereas this value only ever travels inside that
-- parent's own email, and can be rotated without touching anything else.
alter table parents
  add column weekly_digest_enabled boolean not null default true,
  add column unsubscribe_token uuid not null default gen_random_uuid();

comment on column parents.weekly_digest_enabled is 'Whether this parent receives the weekly progress digest email. Opt-out, defaults to on.';
comment on column parents.unsubscribe_token is 'Opaque token for one-click email unsubscribe without an authenticated session.';

create unique index idx_parents_unsubscribe_token on parents(unsubscribe_token);
