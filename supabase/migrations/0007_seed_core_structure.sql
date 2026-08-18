-- Seed: core CAPS skeleton (curriculum, grades 4-7, terms, subjects). This is real
-- structural data (not lesson content), safe to seed idempotently via a migration.
-- Grade/subject NAMES here follow the well-known public CAPS phase structure, but the
-- lesson/topic/question CONTENT seeded separately in later migrations is clearly marked
-- is_demo_content = true and must not be treated as verified curriculum material.

insert into curricula (code, name, country, description)
values ('CAPS', 'CAPS', 'ZA', 'Curriculum and Assessment Policy Statement (South Africa)')
on conflict (code) do nothing;

insert into grades (curriculum_id, grade_number, name, is_launched)
select c.id, g.n, 'Grade ' || g.n, true
from curricula c
cross join (values (4), (5), (6), (7)) as g(n)
where c.code = 'CAPS'
on conflict (curriculum_id, grade_number) do nothing;

insert into terms (grade_id, term_number, name)
select gr.id, t.n, 'Term ' || t.n
from grades gr
cross join (values (1), (2), (3), (4)) as t(n)
where gr.curriculum_id = (select id from curricula where code = 'CAPS')
on conflict (grade_id, term_number) do nothing;

insert into subjects (curriculum_id, code, name, icon_key, color_key)
select c.id, s.code, s.name, s.icon_key, s.color_key
from curricula c
cross join (
  values
    ('MATH', 'Mathematics', 'calculator', 'brand'),
    ('ENG_HL', 'English Home Language', 'book-open', 'sun'),
    ('AFR_FAL', 'Afrikaans First Additional Language', 'languages', 'coral'),
    ('NAT_SCI', 'Natural Sciences', 'flask-conical', 'success'),
    ('SOC_SCI', 'Social Sciences', 'globe', 'warning'),
    ('LIFE_SKILLS', 'Life Skills', 'heart-pulse', 'brand')
) as s(code, name, icon_key, color_key)
where c.code = 'CAPS'
on conflict (curriculum_id, code) do nothing;

insert into grade_subjects (grade_id, subject_id, sort_order)
select gr.id, sub.id, row_number() over (order by sub.code)
from grades gr
join curricula c on c.id = gr.curriculum_id and c.code = 'CAPS'
cross join subjects sub
where sub.curriculum_id = c.id
on conflict (grade_id, subject_id) do nothing;
