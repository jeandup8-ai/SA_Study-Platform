-- Re-enabling topic videos, one at a time, after someone has watched them.
--
-- On 2026-10-13 all 71 topic videos were hidden from learners immediately
-- before launch:
--
--   update public.topic_videos set verified = false where reviewed_at is null;
--
-- WHY. Every one of them was flagged verified = true with reviewed_at NULL,
-- one reviewer id, created inside a four-day window. The trigger
-- internal.stamp_topic_video_reviewed_at() sets reviewed_at whenever
-- verified is set, so those two facts cannot both come from a real review --
-- that is the shape of a bulk seed, not of 71 people-hours of watching.
-- 71 third-party YouTube videos across 15 channels, playing to Grade 4-7
-- children, with nothing recording that anyone had looked at them.
--
-- Nothing was deleted. The rows, titles, channels and topic links are all
-- intact; only `verified` changed, and the learner query
-- (fetchVerifiedTopicVideo, src/lib/curriculum/topicVideos.ts) filters on
-- exactly that. The lesson page is guarded, so a topic with no video simply
-- renders no video.

-- ----------------------------------------------------------- THE QUEUE
-- What is waiting to be watched, worst-covered subject first.
select g.grade_number as grade, s.name as subject, tv.language,
       tv.title, tv.channel_name,
       'https://www.youtube.com/watch?v=' || tv.youtube_video_id as url
from public.topic_videos tv
join public.topics t on t.id = tv.topic_id
join public.subjects s on s.id = t.subject_id
join public.grades g on g.id = t.grade_id
where not tv.verified
order by g.grade_number, s.name, tv.title;

-- -------------------------------------------------------- RE-ENABLE ONE
-- Only after watching it the whole way through. The trigger stamps
-- reviewed_at automatically, so from here the audit trail builds itself and
-- the gap that caused all this cannot reappear silently.
--
--   update public.topic_videos
--      set verified = true, reviewer_id = auth.uid()
--    where id = '<the video id>';
--
-- Set reviewer_id to the person who actually watched it. That column is the
-- difference between "someone approved this" and "this got switched on".

-- ------------------------------------------------------------- PROGRESS
select count(*) filter (where verified)     as live,
       count(*) filter (where not verified) as still_to_watch,
       count(*)                             as total
from public.topic_videos;

-- --------------------------------------------------------------- UNDO
-- There is no bulk re-enable in this file on purpose. Switching all 71 back
-- on in one statement would recreate precisely the state that made them
-- untrustworthy, and it would do it in a way that looks deliberate. If you
-- decide to accept them wholesale, that is a real decision and it should be
-- written down somewhere as one -- not reached by pasting a line from a
-- cleanup script.
