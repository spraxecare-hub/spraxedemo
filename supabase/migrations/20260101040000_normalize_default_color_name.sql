-- Normalize base variant color_name
-- Older builds stored the base product color as 'Default'.
-- We keep base products as color_name = NULL so listings can easily exclude variants.

UPDATE products
SET color_name = NULL,
    color_hex = NULL
WHERE color_name IS NOT NULL
  AND lower(trim(color_name)) = 'default';
