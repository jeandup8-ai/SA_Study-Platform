-- Seed: the 12 skills from spec section 16, and tag the existing demo
-- questions with plausible skills so the skill-mastery engine has real data
-- to compute from immediately. Skill tags on DEMO questions are themselves
-- illustrative (is_demo_content already marks the questions as such) — real
-- imported questions should get their skill tags reviewed same as everything
-- else in the review queue.

insert into skills (code, name, description) values
  ('knowledge', 'Knowledge', 'Recalling facts, terms, and basic concepts'),
  ('understanding', 'Understanding', 'Explaining ideas or concepts in one''s own words'),
  ('application', 'Application', 'Using a concept or procedure in a new but similar situation'),
  ('analysis', 'Analysis', 'Breaking information into parts to explore relationships'),
  ('problem_solving', 'Problem Solving', 'Working through unfamiliar or multi-step problems'),
  ('reasoning', 'Reasoning', 'Drawing logical conclusions from given information'),
  ('critical_thinking', 'Critical Thinking', 'Evaluating information or arguments objectively'),
  ('communication', 'Communication', 'Expressing ideas clearly in writing or explanation'),
  ('visual_literacy', 'Visual Literacy', 'Interpreting diagrams, graphs, maps, and images'),
  ('creativity', 'Creativity', 'Generating original ideas or approaches'),
  ('interpretation', 'Interpretation', 'Making sense of data, text, or context'),
  ('evaluation', 'Evaluation', 'Judging the value or validity of information or a solution')
on conflict (code) do nothing;

-- Tag the Grade 5 Fractions/Multiplication/Reading demo questions. Basic
-- recall-style questions get knowledge+understanding; anything requiring a
-- learner to work out an equivalent value or interpret a passage also gets
-- application/interpretation, so IEB-style application scoring has signal.
do $$
declare
  v_knowledge uuid; v_understanding uuid; v_application uuid; v_interpretation uuid;
  q record;
begin
  select id into v_knowledge from skills where code = 'knowledge';
  select id into v_understanding from skills where code = 'understanding';
  select id into v_application from skills where code = 'application';
  select id into v_interpretation from skills where code = 'interpretation';

  for q in select id, prompt, difficulty from questions where is_demo_content = true
  loop
    insert into question_skills (question_id, skill_id, weight)
    values (q.id, v_understanding, 1.0)
    on conflict do nothing;

    if q.difficulty = 'easy' then
      insert into question_skills (question_id, skill_id, weight)
      values (q.id, v_knowledge, 0.8)
      on conflict do nothing;
    else
      insert into question_skills (question_id, skill_id, weight)
      values (q.id, v_application, 0.9)
      on conflict do nothing;
    end if;

    if q.prompt ilike '%passage%' or q.prompt ilike '%main idea%' then
      insert into question_skills (question_id, skill_id, weight)
      values (q.id, v_interpretation, 0.9)
      on conflict do nothing;
    end if;
  end loop;
end $$;

-- Mark the two harder Fractions questions (already used in the Equivalent
-- Fractions mini quiz) as IEB-style enrichment: applying a rule to a new
-- case rather than pure recall.
update questions set assessment_style = 'ieb_enrichment'
where is_demo_content = true and difficulty = 'medium' and prompt ilike '%equivalent to%';
