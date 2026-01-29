-- Add size/color metadata for checkout
ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS size text;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS size text;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS color_name text;
