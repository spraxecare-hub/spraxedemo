/*
  # Add featured image metadata

  Adds:
    - link_url
    - storage_path
    - image_width
    - image_height
*/

ALTER TABLE featured_images
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS image_width integer,
  ADD COLUMN IF NOT EXISTS image_height integer;
