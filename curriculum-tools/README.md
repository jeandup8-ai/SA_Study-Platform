# curriculum-tools

Admin-run CLI for importing official DBE curriculum source documents (PDF,
DOCX, HTML, TXT) into the curriculum database. Runs standalone with Node —
it is never bundled into the frontend and never runs in a browser.

## What it actually does today

1. **Extracts** text + structure (headings, tables, page numbers) from the
   source file — real extraction via `pdfjs-dist` (PDF), `mammoth` (DOCX), and
   `cheerio` (HTML), not stubs. See `src/parsers/`.
2. **Detects** grade/term/subject/topic candidates with regex and layout
   heuristics tuned to typical CAPS/ATP document structure (a `TERM n` label
   followed by a table whose first column lists topics). See
   `src/detectors/curriculumDetectors.ts`. These are heuristics, not a trained
   classifier — they will get things wrong sometimes, which is why step 3
   exists.
3. **Writes** every detected topic as a `topics` row with
   `content_workflow_status = 'REVIEW_REQUIRED'`, tagged with
   `source_id` / `source_page` / `source_section` pointing back at exactly
   where in the document it came from. **Nothing this script writes is ever
   `VERIFIED` or `PUBLISHED`** — that transition is a deliberate action an
   admin takes in the review UI after checking the extracted record against
   the source page.

## Try it without any credentials

```bash
npm install
npm run import -- --file src/fixtures/sample-atp-fixture.html --document-id test --dry-run
```

`--dry-run` extracts and prints candidates only — no database connection, no
env vars required. Use it to sanity-check a document before a real import.

## Running a real import

1. Add a row to `curriculum/sources/manifest.json` and to the
   `curriculum_sources` table for the document (set its `grade_id`/`subject_id`
   — the importer needs to know what the *whole document* covers; it does not
   detect that per topic).
2. Set environment variables (never commit these):
   - `SUPABASE_URL` — same project as the main app
   - `SUPABASE_SERVICE_ROLE_KEY` — service role key, **server-side only**.
     The RLS policies on curriculum tables require `is_admin()` for writes;
     this script runs unattended outside any parent's session, so it needs
     the service role key, not the publishable/anon key. Neither is present
     in this repo.
3. `npm run import -- --file <path-to-pdf-or-docx> --document-id <the-manifest-id>`
4. Review the results in the admin curriculum review queue before publishing
   anything.

## Known limitations (honest, not hidden)

- Table/column detection from PDF text is geometric-heuristic (grouping text
  runs by x/y position), the same general technique most PDF table extractors
  use — it will not perfectly reconstruct every layout. This is fine because
  nothing it produces is trusted without human review.
- Grade/subject/term/topic detection is regex/pattern based, not an ML
  classifier. It works well when a document follows the common CAPS ATP
  layout (a `TERM n` label followed by a topic table) and less well on
  unusual layouts.
- DOCX/HTML extraction has no native page numbers, so `source_page` is null
  for those — a reviewer needs to note the page manually when verifying.
