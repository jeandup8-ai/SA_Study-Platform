-- topic_videos (0042) had no language dimension. Without one, adding an
-- Afrikaans-medium video to a topic that already has an approved English
-- video would silently replace it for every learner (fetchVerifiedTopicVideo
-- picks the single most recent verified row) -- English speakers would lose
-- their video the moment an Afrikaans one is approved for the same topic.
alter table public.topic_videos
  add column language public.language_code not null default 'en';

create index topic_videos_topic_id_language_idx on public.topic_videos (topic_id, language);
