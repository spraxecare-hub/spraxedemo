/*
  # Update Featured Images

  Adds:
    - link_url (text)
    - storage_path (text)
    - image_width (int)
    - image_height (int)
*/

ALTER TABLE featured_images
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS image_width integer,
  ADD COLUMN IF NOT EXISTS image_height integer;
