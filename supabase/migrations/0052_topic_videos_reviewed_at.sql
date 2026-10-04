-- When a video was actually approved, written by the database.
--
-- WHY. The privacy page makes a specific, falsifiable child-safety promise:
-- "Every video is watched in full and approved by a human on our team
-- before it can appear to any Learner." Until now the table could not
-- evidence it. `topic_videos` recorded *who* reviewed (`reviewer_id`) and
-- when the row was *written* (`created_at`, `updated_at`), but nothing that
-- means "a person approved this, then". A go-live audit asked the question,
-- found 71 verified rows inserted across 15 distinct minutes, and could not
-- tell "reviewed earlier, batch-inserted" from "never reviewed" — the data
-- simply did not contain the answer. It was settled by the owner attesting
-- to it on 2026-10-04, which is a fine answer once and a bad one every time.
--
-- WHY A TRIGGER AND NOT A COLUMN THE APP SETS. A timestamp written by the
-- client is another claim, not evidence: the same session that flips
-- `verified` could write any `reviewed_at` it liked, and the audit would be
-- back to trusting the caller. Setting it in a BEFORE trigger means the
-- value is the database's observation of when `verified` actually changed,
-- and no caller — admin UI, SQL console, service role — can write a
-- different one. It also means `verifyTopicVideo()` needs no change and
-- cannot forget.
--
-- NOTHING IS BACKFILLED. The 71 existing rows keep `reviewed_at = null`,
-- because this database does not know when they were reviewed and inventing
-- a plausible timestamp would fabricate exactly the evidence the column
-- exists to provide. Null here means "approved before this column existed",
-- not "unreviewed" — the two are distinguishable, because an unreviewed row
-- has `verified = false`:
--
--   verified = false                      -> awaiting review
--   verified = true,  reviewed_at is null -> the legacy 71, owner-attested
--   verified = true,  reviewed_at is set  -> reviewed, timestamped by the db
--
-- That third state is the one that grows from here, and it is queryable.

alter table public.topic_videos
  add column if not exists reviewed_at timestamptz;

comment on column public.topic_videos.reviewed_at is
  'When `verified` was last set true, written by the stamp_topic_video_reviewed_at trigger and never by a client. Null on rows approved before this column existed (owner-attested 2026-10-04); an unreviewed row is identified by verified = false, not by this being null.';

create or replace function internal.stamp_topic_video_reviewed_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    -- A row that arrives already verified was approved now. A row that
    -- arrives unverified has not been.
    new.reviewed_at := case when new.verified then now() else null end;
    return new;
  end if;

  if new.verified and not old.verified then
    new.reviewed_at := now();          -- approved
  elsif old.verified and not new.verified then
    new.reviewed_at := null;           -- approval withdrawn; the old stamp
                                       -- no longer describes anything true
  else
    new.reviewed_at := old.reviewed_at; -- unrelated edit: leave it alone,
                                        -- and ignore whatever the caller sent
  end if;

  return new;
end;
$$;

comment on function internal.stamp_topic_video_reviewed_at() is
  'Keeps topic_videos.reviewed_at an observation rather than a claim: the timestamp tracks when `verified` actually changed, and a client-supplied value is always discarded.';

create trigger topic_videos_stamp_reviewed_at
  before insert or update on public.topic_videos
  for each row
  execute function internal.stamp_topic_video_reviewed_at();
