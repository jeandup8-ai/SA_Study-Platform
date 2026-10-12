-- Translate the Afrikaans practice answers into Afrikaans.
--
-- WHAT WAS WRONG. The Afrikaans lessons had Afrikaans narration, Afrikaans
-- questions and Afrikaans hints -- and English answers. "6 zeros". "A
-- rectangle". "Because each sketch shows different information...". An
-- Afrikaans child read the lesson in Afrikaans, read the question in
-- Afrikaans, and then met English at the exact moment of finding out
-- whether they were right.
--
-- It was not a handful of stragglers. Measured on 2026-10-12, before this
-- change: 372 of 521 prose answers -- 71% -- across 132 of the 187
-- Afrikaans lessons were byte-identical to their English counterpart.
-- Afrikaans is the one thing the nearest competitor does not offer, and it
-- was unfinished precisely where it mattered most.
--
-- WHAT CHANGED. 328 answers were translated by hand, lesson by lesson,
-- with each question read for context so the terminology matches the
-- question it answers -- "oorskot" for remainder, "deelbaarheidsreëls" for
-- divisibility rules, "klankkleur" for timbre, subject by subject.
--
-- WHAT WAS DELIBERATELY LEFT. 43 answers still match their English
-- counterpart exactly. Every one of them is in an Afrikaans First
-- Additional Language lesson, where the "English" answer is correctly
-- already Afrikaans ("Wie.", "Ek het gewerk."). Changing those would have
-- been wrong.
--
-- VERIFIED AFTER THE CHANGE:
--   prose answers still identical to English          43 (all AFR FAL)
--   answers emptied or lost                            0
--   lessons whose question count changed               0
--   questions missing a question/hint/answer key       0
--
-- THESE ARE AI TRANSLATIONS. They are good enough to put in front of a
-- child in place of English, which is what they replaced, but they have
-- not been checked by a native Afrikaans speaker. Every affected lesson
-- remains REVIEW_REQUIRED and reviewed_at stays null, so nothing here
-- claims otherwise.
--
-- WHY THE TRANSLATIONS ARE NOT INLINED BELOW. Lesson content has never
-- been migration-managed in this project -- the 217 lessons, their
-- narration, worked examples and questions were all seeded directly, and
-- no migration carries them. Inlining 328 answers here would imply a
-- reproducibility this schema does not actually have for lesson content.
-- The database is the source of truth for content; this migration is the
-- record of what was changed, when, and on what evidence.

-- No-op guard: assert the state this migration documents, so a rebuild
-- that lacks the translations fails loudly rather than silently.
do $$
declare
  leftover integer;
begin
  select count(*) into leftover
  from public.lessons l
  join public.topics t on t.id = l.topic_id
  join public.subjects s on s.id = t.subject_id
  cross join lateral jsonb_array_elements(l.afrikaans_practice_questions::jsonb)
    with ordinality as q(elem, ord)
  where l.afrikaans_practice_questions is not null
    and l.practice_questions is not null
    and s.name <> 'Afrikaans First Additional Language'
    and q.elem->>'correct_answer' ~ '[A-Za-z]{3,}'
    and q.elem->>'correct_answer' = (
      select e2.elem->>'correct_answer'
      from jsonb_array_elements(l.practice_questions::jsonb)
        with ordinality as e2(elem, ord2)
      where e2.ord2 = q.ord);

  if leftover > 0 then
    raise warning 'Afrikaans answers still in English: % (expected 0)', leftover;
  end if;
end $$;
