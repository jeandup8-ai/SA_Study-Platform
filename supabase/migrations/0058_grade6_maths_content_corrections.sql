-- Two factual corrections to Grade 6 Mathematics lessons.
--
-- Found by reading all ten Grade 6 Mathematics lessons in full on
-- 2026-10-12. Every arithmetic result in all ten is correct -- every
-- division, rounding, subtraction and divisibility check verifies. The
-- defects are in exposition and internal consistency, which is what an
-- automated generator gets wrong and a reader catches.
--
-- Both corrections are applied in English and Afrikaans, because the
-- Afrikaans lessons carried the same two errors.
--
-- 1. "Views of 3-D objects and describing position on a grid"
--    The narration teaches that B2 to D4 is "2 squares right, then 2
--    squares up". The stored answer to the practice question on the same
--    page said "2 right, 2 down". A child who learned the lesson and
--    answered it correctly was marked wrong by their own lesson. The
--    narration is right -- row 2 to row 4 is upward -- so the answer is
--    corrected to match it. The Afrikaans answer was also still in
--    English, so it is translated at the same time.
--
-- 2. "Names for very large numbers"
--    The narration introduced 7 693 417 as "a real 9-digit number". It has
--    seven digits. Only the label is wrong, so only the label is changed:
--    the lesson's scope statement ("up to 9 digits") is correct for CAPS
--    Grade 6, and the worked example's 9-column place value table legally
--    holds a 7-digit number.
--
-- NOT FIXED HERE, deliberately. The same lesson defines "billion" twice
-- and the two definitions disagree -- first as a thousand milliards, then
-- as a thousand millions with nine zeros. Which one is right depends on
-- whether CAPS uses the long or short scale, and that is a curriculum
-- decision for a teacher, not a typo to patch. It stays flagged.
--
-- reviewed_at is deliberately NOT set by this migration. That column is
-- the record that a *person* checked a lesson, and this schema separates
-- ai_reviewed from human_reviewed precisely so the two are never
-- confused. Writing it here would erase the only signal showing which
-- lessons still need a human.

-- 1. The grid path answer, both languages.
update public.lessons
set practice_questions = jsonb_set(
      practice_questions::jsonb, '{1,correct_answer}',
      to_jsonb('2 right, 2 up (or equivalent path).'::text)),
    afrikaans_practice_questions = jsonb_set(
      afrikaans_practice_questions::jsonb, '{1,correct_answer}',
      to_jsonb('2 regs, 2 op (of ''n gelykwaardige pad).'::text))
where id = 'd26ea738-42f2-4f8b-a978-0fa389dac9b6';

-- 2. The digit count, both languages. replace() is a no-op once applied.
update public.lessons
set narration_script = replace(narration_script,
      'Let''s look at a real 9-digit number: 7 693 417',
      'Let''s look at a real 7-digit number: 7 693 417'),
    afrikaans_narration_script = replace(afrikaans_narration_script,
      'n regte 9-syfergetal: 7 693 417',
      'n regte 7-syfergetal: 7 693 417')
where id = '32c8a466-52f9-4725-a8e4-b5456cda7cd0';
