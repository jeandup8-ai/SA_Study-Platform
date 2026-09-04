-- Storage for AI-generated topic illustrations (see
-- supabase/functions/generate-topic-illustration). Public bucket: approved
-- illustrations are served straight from the public object URL, no auth
-- round-trip needed to show a picture in a lesson. Writing to it is
-- admin-only -- a child's device can display these images but can never
-- create or replace one.
insert into storage.buckets (id, name, public)
values ('topic-illustrations', 'topic-illustrations', true)
on conflict (id) do nothing;

create policy topic_illustrations_admin_insert on storage.objects
  for insert
  with check (bucket_id = 'topic-illustrations' and internal.is_admin());

create policy topic_illustrations_admin_update on storage.objects
  for update
  using (bucket_id = 'topic-illustrations' and internal.is_admin());
