-- Stable, human-readable URL slugs for the public (ungated) practice-test
-- section. Public URLs must not change when a name is edited, so the slug is
-- stored rather than derived at render time.

-- `unaccent` lives in an extension schema that may not be installed, so fold
-- the handful of accented characters CAPS subject/topic names actually use.
create or replace function internal.unaccent_fallback(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    value,
    'áàâäãåéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ',
    'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC'
  )
$$;

create or replace function internal.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(internal.unaccent_fallback(value)), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  )
$$;

alter table public.subjects add column if not exists slug text;
alter table public.topics add column if not exists slug text;

-- Backfill. Collisions get a numeric suffix so every row ends up addressable.
do $$
declare
  rec record;
  base text;
  candidate text;
  n integer;
begin
  for rec in select id, name from public.subjects where slug is null order by name loop
    base := internal.slugify(rec.name);
    if base = '' then base := 'subject'; end if;
    candidate := base;
    n := 1;
    while exists (select 1 from public.subjects where slug = candidate) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    update public.subjects set slug = candidate where id = rec.id;
  end loop;

  for rec in select id, name, subject_id, grade_id from public.topics where slug is null order by subject_id, grade_id, sort_order, name loop
    base := internal.slugify(rec.name);
    if base = '' then base := 'topic'; end if;
    -- Keep URLs short enough to read in a search result.
    base := left(base, 80);
    candidate := base;
    n := 1;
    while exists (
      select 1 from public.topics
      where slug = candidate
        and subject_id is not distinct from rec.subject_id
        and grade_id is not distinct from rec.grade_id
    ) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    update public.topics set slug = candidate where id = rec.id;
  end loop;
end $$;

alter table public.subjects alter column slug set not null;
alter table public.topics alter column slug set not null;

create unique index if not exists subjects_slug_key on public.subjects (slug);
create unique index if not exists topics_subject_grade_slug_key on public.topics (subject_id, grade_id, slug);

-- The public test list asks "which topics in this grade+subject have approved
-- questions", which is a filtered scan of questions on exactly these columns.
create index if not exists questions_public_lookup_idx
  on public.questions (grade_id, subject_id, topic_id, language)
  where content_workflow_status = 'PUBLISHED';
