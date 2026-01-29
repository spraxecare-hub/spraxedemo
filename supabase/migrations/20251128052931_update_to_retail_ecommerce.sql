/*
  # Update Spraxe to Retail E-Commerce Platform

  ## Overview
  Transform from B2B wholesale to simple retail e-commerce with seller submission feature.

  ## Changes

  ### 1. Update profiles table
  - Add `seller_status` field (pending, approved, rejected)
  - Add `shop_name` for sellers
  - Change role to support 'customer', 'seller', 'admin'

  ### 2. Update products table
  - Remove B2B fields (min_order_quantity, supplier_name, manufacturer_sku)
  - Add `seller_id` to track product owner
  - Add `approval_status` (pending, approved, rejected)
  - Add `rejection_reason` for declined products
  - Simplify pricing (remove tier pricing)

  ### 3. Drop tier_pricing table
  - No longer needed for retail

  ### 4. Update orders table
  - Simplify status (pending, paid, processing, shipped, delivered, cancelled)
  - Add delivery tracking fields

  ### 5. Add seller_applications table
  - Track seller registration requests
*/

-- Update profiles table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'seller_status') THEN
    ALTER TABLE profiles ADD COLUMN seller_status text CHECK (seller_status IN ('pending', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'shop_name') THEN
    ALTER TABLE profiles ADD COLUMN shop_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'shop_description') THEN
    ALTER TABLE profiles ADD COLUMN shop_description text;
  END IF;
END $$;

-- Update role constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('customer', 'seller', 'admin'));

-- Update products table - Add new columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'seller_id') THEN
    ALTER TABLE products ADD COLUMN seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'approval_status') THEN
    ALTER TABLE products ADD COLUMN approval_status text DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'rejection_reason') THEN
    ALTER TABLE products ADD COLUMN rejection_reason text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price') THEN
    ALTER TABLE products ADD COLUMN price decimal(10,2);
  END IF;
END $$;

-- Migrate base_price to price for existing products
UPDATE products SET price = base_price WHERE price IS NULL;

-- Drop tier_pricing table (no longer needed)
DROP TABLE IF EXISTS tier_pricing CASCADE;

-- Update products policies
DROP POLICY IF EXISTS "Anyone can view active products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;

CREATE POLICY "Anyone can view approved products"
  ON products FOR SELECT
  USING (is_active = true AND approval_status = 'approved');

CREATE POLICY "Sellers can view own products"
  ON products FOR SELECT
  TO authenticated
  USING (
    seller_id = auth.uid()
    OR approval_status = 'approved'
  );

CREATE POLICY "Sellers can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    seller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('seller', 'admin')
      AND (profiles.seller_status = 'approved' OR profiles.role = 'admin')
    )
  );

CREATE POLICY "Sellers can update own products"
  ON products FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Admins can manage all products"
  ON products FOR ALL
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

-- Update orders status constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'));

-- Add tracking fields to orders
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tracking_number') THEN
    ALTER TABLE orders ADD COLUMN tracking_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipped_at') THEN
    ALTER TABLE orders ADD COLUMN shipped_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivered_at') THEN
    ALTER TABLE orders ADD COLUMN delivered_at timestamptz;
  END IF;
END $$;

-- Create seller_applications table
CREATE TABLE IF NOT EXISTS seller_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name text NOT NULL,
  shop_description text,
  business_address text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE seller_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own applications"
  ON seller_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create applications"
  ON seller_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage applications"
  ON seller_applications FOR ALL
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_approval ON products(approval_status);
CREATE INDEX IF NOT EXISTS idx_seller_applications_status ON seller_applications(status);

-- Update site settings for retail
UPDATE site_settings 
SET value = '{"name": "Spraxe", "email": "support@spraxe.com", "phone": "+880 1XXXXXXXXX", "description": "Modern e-commerce platform for Bangladesh"}'::jsonb
WHERE key = 'business_info';

-- Clear existing B2B sample data
DELETE FROM products;
DELETE FROM categories;

-- Insert retail categories
INSERT INTO categories (name, slug, description, is_active, sort_order) VALUES
('Electronics', 'electronics', 'Phones, laptops, and electronic devices', true, 1),
('Fashion', 'fashion', 'Clothing, shoes, and accessories', true, 2),
('Home & Kitchen', 'home-kitchen', 'Home appliances and kitchen items', true, 3),
('Beauty & Health', 'beauty-health', 'Beauty products and health items', true, 4),
('Sports & Outdoors', 'sports-outdoors', 'Sports equipment and outdoor gear', true, 5),
('Books & Stationery', 'books-stationery', 'Books, notebooks, and office supplies', true, 6)
ON CONFLICT (slug) DO NOTHING;