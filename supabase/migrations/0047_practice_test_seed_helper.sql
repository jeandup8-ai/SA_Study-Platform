-- Authoring helper for the free practice tests.
--
-- A test is a row in practice_tests plus N questions plus N*4 options plus the
-- link rows, in two languages. Written out longhand that is ~100 lines of SQL
-- per test and every one of them is a chance to mis-key a foreign key. This
-- takes the whole test as one JSON document instead, resolves grade/subject/
-- topic by slug, and is idempotent: re-running it replaces the test's questions
-- rather than duplicating them.
--
-- Questions land as REVIEW_REQUIRED. Publishing is a separate, human action in
-- the admin console.
create or replace function internal.upsert_practice_test(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grade_id uuid;
  v_subject_id uuid;
  v_topic_id uuid;
  v_test_id uuid;
  v_question jsonb;
  v_question_id uuid;
  v_option jsonb;
  v_index integer := 0;
  v_option_index integer;
  v_correct_index integer;
begin
  select id into v_grade_id from public.grades
   where grade_number = (payload ->> 'grade')::integer;
  if v_grade_id is null then
    raise exception 'unknown grade %', payload ->> 'grade';
  end if;

  select id into v_subject_id from public.subjects where slug = payload ->> 'subject';
  if v_subject_id is null then
    raise exception 'unknown subject %', payload ->> 'subject';
  end if;

  -- Optional: links the free test back to the curriculum topic so a visitor who
  -- signs up can be dropped straight into the matching lesson.
  if payload ? 'topic_slug' then
    select id into v_topic_id from public.topics
     where slug = payload ->> 'topic_slug'
       and subject_id = v_subject_id
       and grade_id = v_grade_id;
  end if;

  insert into public.practice_tests (
    grade_id, subject_id, topic_id, slug, title_en, title_af, summary_en, summary_af, sort_order
  )
  values (
    v_grade_id, v_subject_id, v_topic_id,
    payload ->> 'slug',
    payload ->> 'title_en',
    payload ->> 'title_af',
    payload ->> 'summary_en',
    payload ->> 'summary_af',
    coalesce((payload ->> 'sort_order')::smallint, 0)
  )
  on conflict (grade_id, subject_id, slug) do update
    set title_en = excluded.title_en,
        title_af = excluded.title_af,
        summary_en = excluded.summary_en,
        summary_af = excluded.summary_af,
        sort_order = excluded.sort_order,
        topic_id = excluded.topic_id,
        updated_at = now()
  returning id into v_test_id;

  -- Re-authoring a test replaces its questions outright. The cascade on
  -- practice_test_questions clears the links; the questions themselves are
  -- deleted because nothing else references a practice-only question.
  delete from public.questions q
   where q.id in (
     select question_id from public.practice_test_questions where practice_test_id = v_test_id
   );

  for v_question in select * from jsonb_array_elements(payload -> 'questions') loop
    v_index := v_index + 1;
    v_correct_index := (v_question ->> 'correct')::integer;

    insert into public.questions (
      subject_id, grade_id, topic_id, language, difficulty, question_type,
      prompt, correct_answer, explanation, content_workflow_status, is_demo_content
    )
    values (
      v_subject_id, v_grade_id, v_topic_id,
      (v_question ->> 'lang')::public.language_code,
      coalesce((v_question ->> 'difficulty')::public.question_difficulty, 'medium'),
      'multiple_choice',
      v_question ->> 'prompt',
      (v_question -> 'options') ->> v_correct_index,
      v_question ->> 'explanation',
      'REVIEW_REQUIRED',
      false
    )
    returning id into v_question_id;

    v_option_index := 0;
    for v_option in select * from jsonb_array_elements(v_question -> 'options') loop
      insert into public.question_options (question_id, label, is_correct, sort_order)
      values (v_question_id, v_option #>> '{}', v_option_index = v_correct_index, v_option_index);
      v_option_index := v_option_index + 1;
    end loop;

    insert into public.practice_test_questions (practice_test_id, question_id, sort_order)
    values (v_test_id, v_question_id, v_index);
  end loop;

  return v_test_id;
end $$;
