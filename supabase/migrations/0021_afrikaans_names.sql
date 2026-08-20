-- Afrikaans display names for structural/navigational labels (grade, term,
-- subject, topic names) — the pieces of "what should this say in Afrikaans"
-- that live in the database rather than the UI-chrome i18n bundle. These are
-- our own platform labels and standard, well-known SA schooling terms
-- (e.g. "Mathematics" -> "Wiskunde", "Grade 5" -> "Graad 5"), not CAPS
-- curriculum content requiring a sourced document — safe to author directly.
-- Lesson/question body content already has its own per-language rows
-- (lessons.language, questions.language) and is untouched here; full
-- Afrikaans lesson-content translation at scale remains a separate,
-- larger, human-reviewed content task (see README).

alter table grades add column name_af text;
alter table terms add column name_af text;
alter table subjects add column name_af text;
alter table topics add column name_af text;
alter table subtopics add column name_af text;
alter table subject_components add column name_af text;

comment on column subjects.name_af is
  'Afrikaans display name. Falls back to name when null (see src/lib/i18n/localizedName.ts). Not machine-translated: hand-authored standard SA schooling terminology.';

update grades set name_af = 'Graad ' || grade_number where curriculum_id = (select id from curricula where code = 'CAPS');

update terms set name_af = 'Kwartaal ' || term_number
where grade_id in (select id from grades where curriculum_id = (select id from curricula where code = 'CAPS'));

update subjects set name_af = case code
  when 'MATH' then 'Wiskunde'
  when 'ENG_HL' then 'Engels Huistaal'
  when 'AFR_FAL' then 'Afrikaans Eerste Addisionele Taal'
  when 'NAT_SCI' then 'Natuurwetenskappe'
  when 'SOC_SCI' then 'Sosiale Wetenskappe'
  when 'LIFE_SKILLS' then 'Lewensvaardighede'
  when 'TECHNOLOGY' then 'Tegnologie'
  when 'EMS' then 'Ekonomiese en Bestuurswetenskappe'
  when 'LIFE_ORIENTATION' then 'Lewensoriëntering'
  when 'CREATIVE_ARTS_SP' then 'Skeppende Kunste'
  else name_af
end
where curriculum_id = (select id from curricula where code = 'CAPS');

update subject_components set name_af = case code
  when 'CREATIVE_ARTS' then 'Skeppende Kunste'
  when 'PHYSICAL_EDUCATION' then 'Liggaamlike Opvoeding'
  when 'PERSONAL_SOCIAL_WELLBEING' then 'Persoonlike en Sosiale Welstand'
  when 'DANCE' then 'Dans'
  when 'DRAMA' then 'Drama'
  when 'MUSIC' then 'Musiek'
  when 'VISUAL_ARTS' then 'Visuele Kunste'
  else name_af
end;

update topics set name_af = case code
  when 'FRACTIONS' then 'Breuke'
  when 'MULTIPLICATION' then 'Vermenigvuldiging'
  when 'READING_COMPREHENSION' then 'Leesbegrip'
  else name_af
end
where code in ('FRACTIONS', 'MULTIPLICATION', 'READING_COMPREHENSION');
