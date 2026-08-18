-- Internal svg_animation/interactive_demo media are self-contained React components
-- selected by `source` (e.g. "fractions:3:4") — they have no url/embed_url by design.
-- The original constraint didn't account for that; narrow it to the media types that
-- actually need a URL (external/hosted media).
alter table media drop constraint media_approved_requires_url;

alter table media add constraint media_approved_requires_url check (
  approval_status <> 'approved'
  or media_type in ('svg_animation', 'interactive_demo')
  or url is not null
  or embed_url is not null
);
