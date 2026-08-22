update topics t
set validation_status = v.validation_status::curriculum_validation_status,
    validation_confidence = v.validation_confidence,
    secondary_extraction_match = v.secondary_extraction_match,
    source_text_hash = v.source_text_hash,
    validation_timestamp = now(),
    validation_version = '2026-08-22-v2.2-validation'
from jsonb_to_recordset($json$[{"id": "fc591be2-bfc8-44a4-baa5-a1cb705d6b14", "validation_status": "AUTO_VERIFIED", "validation_confidence": 1, "secondary_extraction_match": true, "source_text_hash": "8c4a27709b19764c1b532c479f4d67f174e4ffde4778ba62545210ca5e121131"}, {"id": "fd0a4176-c0d3-4b24-ae0e-bbc3e74f0152", "validation_status": "AUTO_VERIFIED", "validation_confidence": 1, "secondary_extraction_match": true, "source_text_hash": "b81f35494a47991ad145e4a56bfaa09a6e39e65aa88e099ef5e8bcf74e370957"}]$json$::jsonb) as v(
  id uuid,
  validation_status text,
  validation_confidence numeric,
  secondary_extraction_match boolean,
  source_text_hash text
)
where t.id = v.id;