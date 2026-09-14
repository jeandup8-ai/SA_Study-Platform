-- Curated external video suggestions per topic (competitive gap: we don't
-- produce our own video lessons, so this links out to existing YouTube
-- content instead). Never auto-published: every row starts unverified and
-- only a human admin flips `verified`, same review-then-publish shape as
-- `terminology` (see 0016) -- nothing sourced by search or AI reaches a
-- child until a person has actually watched it and approved it.
create table public.topic_videos (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  title text not null,
  youtube_video_id text not null,
  channel_name text not null,
  notes text,
  suggested_by text not null default 'claude',
  verified boolean not null default false,
  reviewer_id uuid references public.admins(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index topic_videos_topic_id_idx on public.topic_videos (topic_id);

alter table public.topic_videos enable row level security;

-- Same shape as terminology_public_read (0016): RLS allows reading all rows,
-- and the app layer is what restricts learner-facing queries to verified=true.
create policy topic_videos_public_read on public.topic_videos
  for select using (true);

create policy topic_videos_admin_write_insert on public.topic_videos
  for insert with check (internal.is_admin());

create policy topic_videos_admin_write_update on public.topic_videos
  for update using (internal.is_admin()) with check (internal.is_admin());

create policy topic_videos_admin_write_delete on public.topic_videos
  for delete using (internal.is_admin());
