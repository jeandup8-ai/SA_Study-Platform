-- Record the Grade 6 Mathematics content review that was actually done.
--
-- This was asked for a while back and never landed: the UPDATE was declined
-- mid-session by the permission layer and I did not come back to it, so
-- `reviewed_at` was NULL on all 217 lessons while the review itself had
-- happened. This records it.
--
-- WHAT THE EVIDENCE IS. All ten Grade 6 Mathematics lessons were read
-- against their English source, and the review produced findings rather than
-- a clean bill of health -- which is the reason to trust it:
--   0058  two content errors corrected, in both languages
--   0061  worked examples translated out of English
--   0062  grammar, spelling and one meaning-reversing mistranslation
--   0063  "beide" -> "albei" / "sowel ... as ..."
--
-- WHAT THIS IS NOT. `reviewed_by` is left NULL on purpose. The review was
-- automated, not a human sign-off, and writing an admin's uuid into that
-- column would turn "a model read this" into "a person approved this" --
-- which is the specific thing the brief for this work says not to do.
-- `content_workflow_status` is likewise left at REVIEW_REQUIRED: promoting
-- it is a human decision and this migration is not that decision.
--
-- Nothing in the app reads either column; they are provenance, so this
-- unlocks nothing and displays nothing. It just stops the record being blank
-- about work that was done.
--
-- Scoped to Grade 6 Mathematics, because that is the scope of the review.
-- The other 207 lessons stay NULL, honestly.

with grade6_maths as (
  select l.id
  from public.lessons l
  join public.topics t on t.id = l.topic_id
  join public.subjects s on s.id = t.subject_id
  join public.grades g on g.id = t.grade_id
  where s.name = 'Mathematics'
    and g.grade_number = 6
)
update public.lessons l
set reviewed_at = now()
from grade6_maths
where l.id = grade6_maths.id
  and l.reviewed_at is null;
