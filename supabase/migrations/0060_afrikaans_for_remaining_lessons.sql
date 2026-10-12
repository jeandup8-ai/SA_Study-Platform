-- Afrikaans for the last 25 lessons that had none.
--
-- WHAT WAS MISSING. 30 of the 217 lessons had a null
-- afrikaans_narration_script. That number conflated three different
-- things, and only one of them was a gap:
--
--   5  legacy-model lessons. NOT broken. They predate the V2 columns and
--      carry 7 lesson_content rows each, which LessonPage renders through
--      its !isV2 branch. "Ekwivalente Breuke" IS the Afrikaans version of
--      "Equivalent Fractions" -- the old model used one row per language.
--      Their afrikaans_* columns are null because those columns belong to
--      a model they do not use. Nothing was changed for them.
--
--   10 Social Sciences lessons, Grades 4-6. A genuine gap: the per-field
--      fallback in lessonV2.ts meant an Afrikaans child silently got
--      English for content taught in their own language.
--
--   15 English Home Language lessons, Grades 4-6. A judgement call, see
--      below.
--
-- WHAT WAS TRANSLATED. All 25 lessons that had English content, across
-- four fields each -- narration_script, visual_storyboard, worked_example
-- and practice_questions -- so 100 fields in total.
--
-- HOW ENGLISH HOME LANGUAGE WAS HANDLED. These lessons teach English:
-- nouns and pronouns, tenses, simile and metaphor. Translating their
-- examples would destroy them -- "The dog wagged its tail" cannot become
-- Afrikaans and still demonstrate an English pronoun. So the explanation,
-- questions, hints and answers are Afrikaans, while every English example,
-- term and sample sentence stays English, the way a bilingual English
-- textbook is written. The grammatical terms themselves (noun, pronoun,
-- adjective, simile, conjunction) are also kept in English, because those
-- are the words a child must recognise in an English exam paper.
--
-- This departs from the convention visible in the Afrikaans First
-- Additional Language lessons, where the English and Afrikaans narration
-- are byte-identical because a language subject keeps its target language
-- in both fields. That convention would have left English HL untranslated.
-- The owner asked for both languages on every subject, so the bilingual
-- approach was used instead. The 15 AFR FAL lessons are untouched and
-- still correctly identical.
--
-- VERIFIED AFTER THE CHANGE, across all 212 V2 lessons:
--   missing Afrikaans narration / storyboard / worked / practice   0 / 0 / 0 / 0
--   Afrikaans narration identical to English                       15 (all AFR FAL)
--   practice-question count differing from English                  0
--   storyboard slide count differing from English                   0
--   worked examples missing problem/final_answer/solution_steps     0
--   practice questions missing question/hint/correct_answer         0
--
-- THESE ARE AI TRANSLATIONS, not checked by a native Afrikaans speaker.
-- Every affected lesson stays REVIEW_REQUIRED and reviewed_at stays null.
--
-- The translations themselves are data in the lessons table, not inlined
-- here, for the same reason as 0059: lesson content has never been
-- migration-managed in this project.

do $$
declare
  gaps integer;
begin
  select count(*) into gaps
  from public.lessons
  where narration_script is not null
    and (afrikaans_narration_script is null
      or afrikaans_visual_storyboard is null
      or afrikaans_worked_example is null
      or afrikaans_practice_questions is null);

  if gaps > 0 then
    raise warning 'V2 lessons still missing Afrikaans content: % (expected 0)', gaps;
  end if;
end $$;
