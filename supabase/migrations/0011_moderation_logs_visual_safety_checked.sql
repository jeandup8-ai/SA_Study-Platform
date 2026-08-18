-- Tracks whether a real vision-safety model actually ran for a given moderation
-- decision, vs. only structural checks (file type/size, EXIF GPS). Lets the admin
-- moderation view (and any future audit) distinguish "checked and passed" from
-- "provider not configured, structural checks only".
alter table moderation_logs add column visual_safety_checked boolean not null default false;
