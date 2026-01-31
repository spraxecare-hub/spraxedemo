-- Add size chart info for clothing products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS size_chart jsonb;
