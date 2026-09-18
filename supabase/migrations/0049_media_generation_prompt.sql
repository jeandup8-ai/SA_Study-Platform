-- Records the prompt an AI-generated image was produced from.
--
-- The illustration review workflow asks a human to approve or reject each
-- generated image. Without the prompt, a reviewer rejecting a picture that
-- misses the topic has no way to tell whether the prompt was wrong or the
-- model simply produced a poor result, and no way to see what changed when
-- the prompt builder is later edited. Nullable because every existing row,
-- and every human-sourced image, has no prompt.
alter table public.media
  add column if not exists generation_prompt text;

comment on column public.media.generation_prompt is
  'For AI-generated media: the exact prompt sent to the provider. Null for human-sourced media.';
