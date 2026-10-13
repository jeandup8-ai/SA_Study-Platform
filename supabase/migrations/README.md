# How migrations are applied here

**Not with `supabase db push`.** There is no `supabase/config.toml` and this
project has never been CLI-linked. Every migration in this directory was
applied by running its SQL against the database directly — through the
Supabase SQL editor or the MCP tooling — and the remote record was written
separately.

That record lives in `supabase_migrations.schema_migrations`. As of
2026-10-13 it holds 67 rows for the 67 files here, with no duplicates and no
gaps.

## Two things to know before trusting it

**The `version` column is an apply-time timestamp, not something derived from
the filename.** Our files are numbered sequentially (`0001_`…`0067_`), which
is not the 14-digit timestamp prefix the Supabase CLI expects. So the
filenames and the recorded versions do not correspond, and lining them up is
a prerequisite for ever using `supabase db push` — not something that
backfilling the table fixed.

**29 of the rows are recorded without their numeric prefix.** `0021_afrikaans_names`
on disk is `afrikaans_names` in the table, and so on for the rest of
0021–0050. Each one pairs exactly, verified by diff; it is a naming
inconsistency from however they were applied at the time, not a missing
migration. They were left as they are rather than rewritten, because those
are the names under which they really were applied and tidying historical
audit rows to look neater is the wrong instinct. If you want the table to
mirror the filenames:

```sql
-- Optional, cosmetic. Makes the 29 older rows match their filenames.
update supabase_migrations.schema_migrations m
set name = f.fname
from (values
  ('afrikaans_names', '0021_afrikaans_names')
  -- …one row per migration; generate from `ls supabase/migrations`
) as f(oldname, fname)
where m.name = f.oldname;
```

**Rows 0051–0067 were backfilled on 2026-10-13** and carry
`created_by = 'backfilled 2026-10-13: applied via SQL, not via CLI push'`
with `statements` left NULL — the same shape `supabase migration repair
--status applied` produces. NULL rather than the file contents on purpose:
several of those migrations were applied in chunks, so a recorded statement
array would not be what actually ran.
