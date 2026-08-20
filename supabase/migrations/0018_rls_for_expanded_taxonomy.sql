-- RLS for tables added in 0013/0014: same default-deny posture as the rest of
-- the curriculum content tables — public read, admin write only.

do $$
declare
  t text;
begin
  foreach t in array array[
    'phases', 'subject_components', 'strands', 'curriculum_outcomes',
    'curriculum_sources', 'curriculum_versions', 'atp_entries'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_public_read on %I for select using (true)', t, t);
    execute format('create policy %I_admin_write_insert on %I for insert with check (is_admin())', t, t);
    execute format('create policy %I_admin_write_update on %I for update using (is_admin()) with check (is_admin())', t, t);
    execute format('create policy %I_admin_write_delete on %I for delete using (is_admin())', t, t);
  end loop;
end $$;
