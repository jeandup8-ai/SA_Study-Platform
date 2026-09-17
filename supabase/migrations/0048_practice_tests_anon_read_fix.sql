-- The public read policies called `internal.is_admin()` inside an OR. The
-- `anon` role has no EXECUTE grant on that function, and Postgres does not
-- guarantee it will short-circuit the OR, so an anonymous visitor got
-- "permission denied for function is_admin" instead of the published rows --
-- which would have made the entire free practice section unreachable for
-- exactly the audience it was built for.
--
-- Split into two policies instead. Policies are OR'd together, and the admin
-- one is scoped TO authenticated, so an anonymous request never reaches the
-- function at all.

drop policy practice_tests_public_read on public.practice_tests;
drop policy practice_test_questions_public_read on public.practice_test_questions;

create policy practice_tests_published_read on public.practice_tests
  for select using (is_published);

create policy practice_tests_admin_read on public.practice_tests
  for select to authenticated using (internal.is_admin());

create policy practice_test_questions_published_read on public.practice_test_questions
  for select using (
    exists (
      select 1 from public.practice_tests pt
      where pt.id = practice_test_id and pt.is_published
    )
  );

create policy practice_test_questions_admin_read on public.practice_test_questions
  for select to authenticated using (internal.is_admin());
