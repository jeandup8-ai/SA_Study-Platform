-- Server-side limits for the topic-illustrations bucket, and provenance
-- wording that covers artwork a human generated elsewhere.
--
-- Context: the Illustration Studio can now accept an image produced outside
-- this project (ChatGPT) instead of only ones its own edge function
-- generated. That is a new way for bytes to reach storage, and the checks
-- in the browser that decide whether to offer the upload button are not a
-- security boundary -- anyone holding an admin session can call the storage
-- API directly. The bucket itself had no ceiling of any kind: no size
-- limit, no MIME allowlist. These two settings are enforced by Storage
-- regardless of what any client sends.
--
-- No policy is changed, added or relaxed. Writing to this bucket was
-- admin-only before (topic_illustrations_admin_insert, migration 0033) and
-- is admin-only after; `media_read` still exposes only approved rows. This
-- migration can only narrow what is accepted.

-- 8MB. Every one of the 152 objects already in the bucket is between
-- 1.17MB and 1.66MB, so this bounds a mistake -- a phone photo, an
-- unflattened export -- without being close to what correct artwork weighs.
-- The three types are what the pipeline actually produces and accepts:
-- image/png is what generate-topic-illustration writes, image/webp is what
-- new artwork is asked for, image/jpeg is tolerated.
update storage.buckets
set
  file_size_limit = 8388608,
  allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg']
where id = 'topic-illustrations';

-- The original wording said "Null for human-sourced media", which was true
-- when the only images came from the API. An uploaded image was still
-- produced from a prompt; a person pasted it into a tool rather than the
-- server posting it to an endpoint, and a reviewer deciding whether a weak
-- picture came from a weak prompt needs it either way.
comment on column public.media.generation_prompt is
  'The prompt the image was produced from, whether this project''s edge function sent it to a provider (provider=''openai'') or a person pasted it into an external tool and uploaded the result (provider=''external_upload''). Null when no prompt was recorded.';

comment on column public.media.provider is
  'Where the asset came from. ''internal'' for assets this product renders itself, ''openai'' for images generate-topic-illustration produced through the API, ''external_upload'' for images a person generated elsewhere and uploaded through the Illustration Studio. The specific tool is in `source`.';

comment on column public.media.source is
  'Sub-provenance. ''ai_generated:<model>'' for API-generated images, ''external_upload:<tool>'' (e.g. external_upload:chatgpt) for uploads, or a generator key for internal assets.';
