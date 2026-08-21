-- Real CAPS source documents, supplied by the product owner and verified against
-- SOURCE_MANIFEST.json before this migration was written: SHA-256 + byte-count
-- match for all 9 files, and each was independently re-checked with pdfjs-dist
-- to confirm genuine CAPS document structure (title pages, phase/grade banners,
-- section/chapter headings) rather than trusting the manifest metadata alone.
--
-- status = 'IMPORTED' means exactly that: the real file is stored under
-- curriculum/sources/caps/ with a matching checksum. No curriculum content has
-- been extracted from these yet — that happens via curriculum-tools/importSource.ts
-- and lands in content_workflow_status = 'REVIEW_REQUIRED', never VERIFIED or
-- PUBLISHED, until a human checks it.

insert into curriculum_sources
  (document_id, organisation, title, document_type, phase_id, subject_id, version, official_url, local_file_path, checksum, import_date, status)
select
  v.document_id, 'Department of Basic Education (South Africa)', v.title, 'caps'::source_document_type,
  ph.id, sub.id, v.version, v.official_url, v.local_file_path, v.checksum, now(), 'IMPORTED'::source_verification_status
from (
  values
    ('dbe-caps-math-ip', 'CAPS Mathematics — Intermediate Phase (Grades 4-6)', 'INTERMEDIATE', 'MATH', 'Final Draft',
     'https://www.education.gov.za/Portals/0/Documents/Policies/CAPS/MATHEMATICS%20Intermediate.pdf',
     'curriculum/sources/caps/CAPS_Mathematics_Grades4-6.pdf',
     '31c594425ff787a531c6ef6cceaaead09d5ad50d1b54ca36c33bcf19663068b5'),
    ('dbe-caps-lifeskills-ip', 'CAPS Life Skills — Intermediate Phase (Grades 4-6)', 'INTERMEDIATE', 'LIFE_SKILLS', null,
     'https://www.education.gov.za/Portals/0/Documents/CSE%20Scripted%20lessons/CAPS%20IP%20%20LIFE%20SKILLS%20GR%204-6%20%20WEB.pdf',
     'curriculum/sources/caps/CAPS_Life_Skills_Grades4-6.pdf',
     '4113b006498494cd90bc5203c88ca2d5a1a1856c42b0274a31cc3f1442412317'),
    ('dbe-caps-nst-ip-amendment', 'CAPS Natural Sciences and Technology — Intermediate Phase (Grades 4-6) — content amendment', 'INTERMEDIATE', 'NAT_SCI', null,
     'https://www.education.gov.za/Portals/0/Documents/Publications/CAPS%20Commnets/GET/NS%20AND%20TECH%20IP%20GRADES%204%20-%206%20EDITED2.pdf?ver=2018-09-05-090256-023',
     'curriculum/sources/caps/CAPS_Natural_Sciences_Technology_Grades4-6.pdf',
     'b2b62cb589a93261c665bfc4444da2d96646d0c6993e29034520242521d6bc61'),
    ('dbe-caps-socsci-ip', 'CAPS Social Sciences — Intermediate Phase (Grades 4-6)', 'INTERMEDIATE', 'SOC_SCI', null,
     'https://www.education.gov.za/Portals/0/Documents/SOCIAL%20SCIENCES%20Int.pdf',
     'curriculum/sources/caps/CAPS_Social_Sciences_Grades4-6.pdf',
     '1a5865802399614b4187e0e4f499a6c866d441fdcc4a6f0c310eee2ae60d6b5c'),
    ('dbe-caps-math-sp', 'CAPS Mathematics — Senior Phase (Grades 7-9)', 'SENIOR', 'MATH', 'Final Draft',
     'https://www.education.gov.za/Portals/0/Documents/MATHEMATICS%20Sen.pdf',
     'curriculum/sources/caps/CAPS_Mathematics_Grade7-9.pdf',
     'b4d8d1d7bba094444039ffe049cb4e28be420f3f4eda2f4fd3a459c34d41a9be'),
    ('dbe-caps-natsci-sp', 'CAPS Natural Sciences — Senior Phase (Grades 7-9)', 'SENIOR', 'NAT_SCI', null,
     'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20SP%20%20NATURAL%20SCIENCES%20GR%207-9%20%20WEB.pdf?ver=2015-01-27-160159-297',
     'curriculum/sources/caps/CAPS_Natural_Sciences_Grade7-9.pdf',
     '8699f105ebee604a9b0a0aebcbd7e9ebac27f5e034b00559a19f8418e1615e9f'),
    ('dbe-caps-tech-sp', 'CAPS Technology — Senior Phase (Grades 7-9)', 'SENIOR', 'TECHNOLOGY', null,
     'https://www.education.gov.za/Portals/0/Documents/Publications/CAPS%20Commnets/GET/TECHNOLOGY%20SP%20GRADES%207%20-%209%20EDITED.PDF',
     'curriculum/sources/caps/CAPS_Technology_Grade7-9.pdf',
     '0539b8093453d357ed9b7473dda80f2a29d5515910c46134f9088b53ba996c09'),
    ('dbe-caps-creativearts-sp', 'CAPS Creative Arts — Senior Phase (Grades 7-9)', 'SENIOR', 'CREATIVE_ARTS_SP', null,
     'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20SP%20%20CREATIVE%20ARTS%20GR%207-9%20%20web.pdf?ver=2015-01-27-160105-653',
     'curriculum/sources/caps/CAPS_Creative_Arts_Grade7-9.pdf',
     'eabc3325fc1569737f31c4e694e27bfc271bca3c2a6be4eb4de049b46cd30f14'),
    ('dbe-caps-humansocsci-sp', 'CAPS Social Sciences — Senior Phase (Grades 7-9)', 'SENIOR', 'SOC_SCI', 'Final Draft',
     'https://www.education.gov.za/Portals/0/Documents/Policies/CAPS/HUMAN%20AND%20SOCIAL%20SCIENCES.pdf',
     'curriculum/sources/caps/CAPS_Human_Social_Sciences_Grade7-9.pdf',
     'f53548d277d475c330a26ec04c2380917ce997b12af1dfa331bf200b84095038')
) as v(document_id, title, phase_code, subject_code, version, official_url, local_file_path, checksum)
join phases ph on ph.code = v.phase_code
join subjects sub on sub.code = v.subject_code
on conflict (document_id) do update set
  checksum = excluded.checksum,
  local_file_path = excluded.local_file_path,
  status = excluded.status,
  import_date = excluded.import_date;
