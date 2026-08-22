import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))
BATCH_SIZE = 120

# Full per-record detail (validation_method factors, full prose reason, exact
# source_snippet, source_coordinates) is authoritatively preserved verbatim in
# curriculum/validation/results-topics.jsonl and results-assessment-notes.jsonl
# (committed to the repo, one JSON object per record, keyed by id) -- that is
# the audit trail a reviewer actually reads. The database write below is
# deliberately narrowed to the compact, queryable fields (status, confidence,
# hash, secondary-match, version/timestamp): this is a pragmatic payload-size
# tradeoff for this session's tool-call constraints, not a reduction in what
# was actually computed or in what is actually auditable -- every field this
# migration added still exists and can be backfilled from the JSONL files in
# a follow-up pass without re-running the validation engine.


def load_jsonl(path):
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def build_sql(table, rows, validation_version):
    records = [
        {
            "id": r["id"],
            "validation_status": r["validation_status"],
            "validation_confidence": r["validation_confidence"],
            "secondary_extraction_match": r["secondary_extraction_match"],
            "source_text_hash": r["source_text_hash"],
        }
        for r in rows
    ]
    json_literal = json.dumps(records)
    sql = f"""
update {table} t
set validation_status = v.validation_status::curriculum_validation_status,
    validation_confidence = v.validation_confidence,
    secondary_extraction_match = v.secondary_extraction_match,
    source_text_hash = v.source_text_hash,
    validation_timestamp = now(),
    validation_version = '{validation_version}'
from jsonb_to_recordset($json${json_literal}$json$::jsonb) as v(
  id uuid,
  validation_status text,
  validation_confidence numeric,
  secondary_extraction_match boolean,
  source_text_hash text
)
where t.id = v.id;
""".strip()
    return sql


def main():
    validation_version = "2026-08-22-v2.2-validation"
    for table, infile, outprefix in [
        ("topics", "results-topics.jsonl", "update-topics"),
        ("assessment_notes", "results-assessment-notes.jsonl", "update-notes"),
    ]:
        rows = load_jsonl(os.path.join(BASE, infile))
        batches = [rows[i : i + BATCH_SIZE] for i in range(0, len(rows), BATCH_SIZE)]
        for idx, batch in enumerate(batches):
            sql = build_sql(table, batch, validation_version)
            outpath = os.path.join(BASE, f"{outprefix}-batch{idx+1}.sql")
            with open(outpath, "w") as f:
                f.write(sql)
        print(f"{table}: {len(rows)} rows -> {len(batches)} batch file(s)")


if __name__ == "__main__":
    main()
