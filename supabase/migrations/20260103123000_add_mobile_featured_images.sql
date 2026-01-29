/*
  # Add mobile-specific featured images

  Adds optional columns to support separate mobile images for:
  - homepage hero slider
  - homepage info carousel (between paragraphs)

  Note: the homepage/product-page banner uses site_settings (JSON),
  so no schema change is required for the banner.
*/

ALTER TABLE featured_images
  ADD COLUMN IF NOT EXISTS mobile_image_url text,
  ADD COLUMN IF NOT EXISTS mobile_storage_path text,
  ADD COLUMN IF NOT EXISTS mobile_image_width integer,
  ADD COLUMN IF NOT EXISTS mobile_image_height integer;
