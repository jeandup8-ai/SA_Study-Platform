-- Row Level Security. Default posture: curriculum/content tables are publicly readable
-- (needed to browse lessons before/after login and for the marketing site) and writable
-- only by admins. Learner-owned data is readable/writable only by that learner's parent.
-- Nothing here trusts client-supplied learner_id/parent_id -- every policy re-derives
-- ownership from auth.uid() via a join, never from a column the client could spoof.

-- ---------- Curriculum content: public read, admin write ----------
alter table curricula enable row level security;
alter table grades enable row level security;
alter table terms enable row level security;
alter table subjects enable row level security;
alter table grade_subjects enable row level security;
alter table topics enable row level security;
alter table subtopics enable row level security;
alter table learning_objectives enable row level security;
alter table lessons enable row level security;
alter table lesson_content enable row level security;
alter table media enable row level security;
alter table questions enable row level security;
alter table question_options enable row level security;
alter table assessments enable row level security;
alter table assessment_questions enable row level security;
alter table exam_periods enable row level security;
alter table subscription_plans enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'curricula','grades','terms','subjects','grade_subjects','topics','subtopics',
    'learning_objectives','lessons','lesson_content','media','questions','question_options',
    'assessments','assessment_questions','exam_periods','subscription_plans'
  ]
  loop
    execute format('create policy %I_public_read on %I for select using (true)', t, t);
    execute format('create policy %I_admin_write_insert on %I for insert with check (is_admin())', t, t);
    execute format('create policy %I_admin_write_update on %I for update using (is_admin()) with check (is_admin())', t, t);
    execute format('create policy %I_admin_write_delete on %I for delete using (is_admin())', t, t);
  end loop;
end $$;

-- Media approved-only visibility for non-admins: children should never see unapproved/
-- pending external media. Replace the blanket read policy on `media` with an approval check.
drop policy media_public_read on media;
create policy media_read on media for select
  using (approval_status = 'approved' or is_admin());

-- ---------- Parent identity ----------
alter table parents enable row level security;

create policy parents_select_self on parents for select
  using (id = auth.uid() or is_admin());
create policy parents_insert_self on parents for insert
  with check (id = auth.uid());
create policy parents_update_self on parents for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- Learners: owned by parent ----------
alter table learners enable row level security;

create policy learners_select_own on learners for select
  using (parent_id = auth.uid() or is_admin());
create policy learners_insert_own on learners for insert
  with check (parent_id = auth.uid());
create policy learners_update_own on learners for update
  using (parent_id = auth.uid()) with check (parent_id = auth.uid());
create policy learners_delete_own on learners for delete
  using (parent_id = auth.uid());

-- ---------- Learner-scoped activity tables ----------
-- All of these re-derive ownership via a subquery against learners, never trusting a
-- client-supplied parent_id column directly.
alter table learner_progress enable row level security;
alter table study_sessions enable row level security;
alter table mastery enable row level security;
alter table mastery_weakness_signals enable row level security;
alter table assessment_attempts enable row level security;
alter table exam_readiness enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'learner_progress','study_sessions','mastery','mastery_weakness_signals',
    'assessment_attempts','exam_readiness'
  ]
  loop
    execute format(
      'create policy %I_owner_select on %I for select using (
         exists (select 1 from learners l where l.id = %I.learner_id and (l.parent_id = auth.uid() or is_admin()))
       )', t, t, t);
    execute format(
      'create policy %I_owner_insert on %I for insert with check (
         exists (select 1 from learners l where l.id = %I.learner_id and l.parent_id = auth.uid())
       )', t, t, t);
    execute format(
      'create policy %I_owner_update on %I for update using (
         exists (select 1 from learners l where l.id = %I.learner_id and l.parent_id = auth.uid())
       ) with check (
         exists (select 1 from learners l where l.id = %I.learner_id and l.parent_id = auth.uid())
       )', t, t, t, t);
  end loop;
end $$;

-- assessment_answers is scoped via its parent attempt, not directly via learner_id.
alter table assessment_answers enable row level security;

create policy assessment_answers_owner_select on assessment_answers for select
  using (
    exists (
      select 1 from assessment_attempts a
      join learners l on l.id = a.learner_id
      where a.id = assessment_answers.attempt_id and (l.parent_id = auth.uid() or is_admin())
    )
  );
create policy assessment_answers_owner_insert on assessment_answers for insert
  with check (
    exists (
      select 1 from assessment_attempts a
      join learners l on l.id = a.learner_id
      where a.id = assessment_answers.attempt_id and l.parent_id = auth.uid()
    )
  );

-- ---------- Subscriptions & moderation logs: parent-owned ----------
alter table subscriptions enable row level security;
create policy subscriptions_owner_select on subscriptions for select
  using (parent_id = auth.uid() or is_admin());
create policy subscriptions_owner_insert on subscriptions for insert
  with check (parent_id = auth.uid());
create policy subscriptions_owner_update on subscriptions for update
  using (parent_id = auth.uid()) with check (parent_id = auth.uid());

alter table moderation_logs enable row level security;
create policy moderation_logs_owner_select on moderation_logs for select
  using (parent_id = auth.uid() or is_admin());
create policy moderation_logs_owner_insert on moderation_logs for insert
  with check (parent_id = auth.uid());

-- ---------- Admin & audit tables ----------
alter table admins enable row level security;
create policy admins_self_or_admin_select on admins for select
  using (id = auth.uid() or is_admin());

alter table audit_logs enable row level security;
create policy audit_logs_admin_select on audit_logs for select
  using (is_admin());
create policy audit_logs_self_insert on audit_logs for insert
  with check (actor_id = auth.uid() or actor_type = 'system');
