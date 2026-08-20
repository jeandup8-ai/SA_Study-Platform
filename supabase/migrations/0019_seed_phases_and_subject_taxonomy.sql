-- Seed: phases, subject components, and the Grade 4-7 subject list. These are
-- the DBE's own public organisational category names for CAPS (e.g. "Life
-- Skills contains Creative Arts / Physical Education / Personal and Social
-- Well-being" is how CAPS itself structures the subject) — this is structural
-- taxonomy, not curriculum CONTENT (no topic, subtopic, learning objective, or
-- lesson is seeded here). It is safe to record without a downloaded source
-- document. Every row it touches is still gated behind content_workflow_status
-- for anything that actually is content.

do $$
declare
  v_curriculum_id uuid;
  v_intermediate_id uuid;
  v_senior_id uuid;
  v_grade4 uuid;
  v_grade5 uuid;
  v_grade6 uuid;
  v_grade7 uuid;
  v_life_skills_id uuid;
  v_creative_arts_7_id uuid;
  v_eng_hl_id uuid;
  v_afr_fal_id uuid;
begin
  select id into v_curriculum_id from curricula where code = 'CAPS';

  insert into phases (curriculum_id, code, name, grade_range_start, grade_range_end, sort_order)
  values
    (v_curriculum_id, 'FOUNDATION', 'Foundation Phase', 1, 3, 1),
    (v_curriculum_id, 'INTERMEDIATE', 'Intermediate Phase', 4, 6, 2),
    (v_curriculum_id, 'SENIOR', 'Senior Phase', 7, 9, 3),
    (v_curriculum_id, 'FET', 'Further Education and Training Phase', 10, 12, 4)
  on conflict (curriculum_id, code) do nothing;

  select id into v_intermediate_id from phases where curriculum_id = v_curriculum_id and code = 'INTERMEDIATE';
  select id into v_senior_id from phases where curriculum_id = v_curriculum_id and code = 'SENIOR';

  select id into v_grade4 from grades where curriculum_id = v_curriculum_id and grade_number = 4;
  select id into v_grade5 from grades where curriculum_id = v_curriculum_id and grade_number = 5;
  select id into v_grade6 from grades where curriculum_id = v_curriculum_id and grade_number = 6;
  select id into v_grade7 from grades where curriculum_id = v_curriculum_id and grade_number = 7;

  update grades set phase_id = v_intermediate_id where id in (v_grade4, v_grade5, v_grade6);
  update grades set phase_id = v_senior_id where id = v_grade7;

  -- Life Skills components (Intermediate Phase) — preserved separately per spec section 4.
  select id into v_life_skills_id from subjects where curriculum_id = v_curriculum_id and code = 'LIFE_SKILLS';
  if v_life_skills_id is not null then
    insert into subject_components (subject_id, code, name, sort_order) values
      (v_life_skills_id, 'CREATIVE_ARTS', 'Creative Arts', 1),
      (v_life_skills_id, 'PHYSICAL_EDUCATION', 'Physical Education', 2),
      (v_life_skills_id, 'PERSONAL_SOCIAL_WELLBEING', 'Personal and Social Well-being', 3)
    on conflict (subject_id, code) do nothing;
  end if;

  -- Grade 7 Senior Phase subject list additions not already seeded for Grade 4-6
  -- (English Home Language / Afrikaans FAL already exist; add the Senior-Phase-only
  -- subjects: Technology, Economic and Management Sciences, Life Orientation,
  -- Creative Arts — kept distinct from the Intermediate Phase's combined
  -- "Natural Sciences and Technology" and "Life Skills", matching CAPS's own
  -- Senior Phase restructuring).
  insert into subjects (curriculum_id, code, name, icon_key, color_key)
  select v_curriculum_id, s.code, s.name, s.icon_key, s.color_key
  from (values
    ('TECHNOLOGY', 'Technology', 'wrench', 'warning'),
    ('EMS', 'Economic and Management Sciences', 'briefcase', 'success'),
    ('LIFE_ORIENTATION', 'Life Orientation', 'heart-pulse', 'brand'),
    ('CREATIVE_ARTS_SP', 'Creative Arts', 'palette', 'coral')
  ) as s(code, name, icon_key, color_key)
  on conflict (curriculum_id, code) do nothing;

  select id into v_creative_arts_7_id from subjects where curriculum_id = v_curriculum_id and code = 'CREATIVE_ARTS_SP';
  if v_creative_arts_7_id is not null then
    insert into subject_components (subject_id, code, name, sort_order) values
      (v_creative_arts_7_id, 'DANCE', 'Dance', 1),
      (v_creative_arts_7_id, 'DRAMA', 'Drama', 2),
      (v_creative_arts_7_id, 'MUSIC', 'Music', 3),
      (v_creative_arts_7_id, 'VISUAL_ARTS', 'Visual Arts', 4)
    on conflict (subject_id, code) do nothing;
  end if;

  -- Grade 7's official subject set differs from Grade 4-6 (Senior Phase splits
  -- Natural Sciences and Technology apart, and swaps Life Skills for Life
  -- Orientation + Creative Arts + EMS + Technology). Wire grade_subjects for
  -- Grade 7 explicitly rather than reusing the Intermediate Phase mapping.
  delete from grade_subjects where grade_id = v_grade7;

  select id into v_eng_hl_id from subjects where curriculum_id = v_curriculum_id and code = 'ENG_HL';
  select id into v_afr_fal_id from subjects where curriculum_id = v_curriculum_id and code = 'AFR_FAL';

  insert into grade_subjects (grade_id, subject_id, sort_order)
  select v_grade7, sub.id, row_number() over (order by sub.sort_order)
  from (
    select id, 1 as sort_order from subjects where curriculum_id = v_curriculum_id and code = 'MATH'
    union all select v_eng_hl_id, 2
    union all select v_afr_fal_id, 3
    union all select id, 4 from subjects where curriculum_id = v_curriculum_id and code = 'NAT_SCI'
    union all select id, 5 from subjects where curriculum_id = v_curriculum_id and code = 'TECHNOLOGY'
    union all select id, 6 from subjects where curriculum_id = v_curriculum_id and code = 'SOC_SCI'
    union all select id, 7 from subjects where curriculum_id = v_curriculum_id and code = 'EMS'
    union all select id, 8 from subjects where curriculum_id = v_curriculum_id and code = 'LIFE_ORIENTATION'
    union all select v_creative_arts_7_id, 9
  ) as sub(id, sort_order)
  on conflict (grade_id, subject_id) do nothing;
end $$;
