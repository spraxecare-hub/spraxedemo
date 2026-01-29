/*
  # Product manual specs + color variants + voucher code tracking

  - Adds `product_specs` table for manual key/value specs per product
  - Adds color variant fields to `products` so multiple products can be grouped by color
  - Adds `discount_code` to `orders` so invoices can show which voucher was applied
*/

-- 1) Manual specs table
CREATE TABLE IF NOT EXISTS product_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label text NOT NULL,
  value text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_specs_product_id ON product_specs(product_id);

ALTER TABLE product_specs ENABLE ROW LEVEL SECURITY;

-- Anyone can view specs for active+approved products
DROP POLICY IF EXISTS "Anyone can view product specs" ON product_specs;
CREATE POLICY "Anyone can view product specs"
  ON product_specs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_specs.product_id
        AND p.is_active = true
        AND (p.approval_status IS NULL OR p.approval_status = 'approved')
    )
  );

-- Admins can manage
DROP POLICY IF EXISTS "Admins can manage product specs" ON product_specs;
CREATE POLICY "Admins can manage product specs"
  ON product_specs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_product_specs_updated_at'
  ) THEN
    CREATE TRIGGER set_product_specs_updated_at
    BEFORE UPDATE ON product_specs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 2) Color variants: group id + name + hex
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'color_group_id') THEN
    ALTER TABLE products ADD COLUMN color_group_id uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'color_name') THEN
    ALTER TABLE products ADD COLUMN color_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'color_hex') THEN
    ALTER TABLE products ADD COLUMN color_hex text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_color_group_id ON products(color_group_id);

-- Backfill: standalone products become their own "group"
UPDATE products SET color_group_id = id WHERE color_group_id IS NULL;

-- 3) Track applied voucher code on orders (for invoices/records)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'discount_code') THEN
    ALTER TABLE orders ADD COLUMN discount_code text;
  END IF;
END $$;
