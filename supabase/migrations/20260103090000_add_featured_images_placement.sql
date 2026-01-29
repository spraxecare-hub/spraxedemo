/*
  # Add placement column to featured_images

  This enables using the same Featured Images admin screen to manage
  multiple homepage carousels.

  Values:
    - hero: main homepage hero slider (default)
    - info_carousel: carousel placed between the first two homepage paragraphs
*/

ALTER TABLE featured_images
  ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT 'hero';

UPDATE featured_images
SET placement = 'hero'
WHERE placement IS NULL;

CREATE INDEX IF NOT EXISTS featured_images_placement_sort_idx
  ON featured_images(placement, sort_order);
