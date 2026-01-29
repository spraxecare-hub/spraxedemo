/*
  # Create Cart and Discount Tables

  ## Overview
  Add tables for shopping cart functionality and discount codes to support e-commerce features.

  ## Changes

  ### 1. Create cart_items table
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users) - who owns this cart item
  - `product_id` (uuid, references products) - which product
  - `quantity` (integer) - how many items
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

  ### 2. Create discount_codes table
  - `id` (uuid, primary key)
  - `code` (text, unique) - the coupon code
  - `discount_type` (text) - 'percentage' or 'fixed'
  - `discount_value` (decimal) - percentage (0-100) or fixed amount
  - `min_purchase` (decimal) - minimum purchase required
  - `max_uses` (integer) - maximum number of uses
  - `current_uses` (integer) - current usage count
  - `valid_from` (timestamp) - when code becomes active
  - `valid_until` (timestamp) - when code expires
  - `is_active` (boolean) - whether code is currently active
  - `created_at` (timestamp)

  ### 3. Security
  - Enable RLS on both tables
  - Users can manage their own cart items
  - Anyone can view active discount codes
  - Only admins can manage discount codes
*/

-- Create cart_items table
CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  quantity integer DEFAULT 1 NOT NULL CHECK (quantity > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);

-- Enable RLS
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Cart items policies
CREATE POLICY "Users can view own cart items"
  ON cart_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cart items"
  ON cart_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cart items"
  ON cart_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cart items"
  ON cart_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create discount_codes table
CREATE TABLE IF NOT EXISTS discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value decimal(10,2) NOT NULL CHECK (discount_value > 0),
  min_purchase decimal(10,2) DEFAULT 0,
  max_uses integer,
  current_uses integer DEFAULT 0,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active);

-- Enable RLS
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- Discount codes policies
CREATE POLICY "Anyone can view active discount codes"
  ON discount_codes FOR SELECT
  USING (
    is_active = true 
    AND valid_from <= now() 
    AND (valid_until IS NULL OR valid_until >= now())
  );

CREATE POLICY "Admins can manage discount codes"
  ON discount_codes FOR ALL
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

-- Insert sample discount code
INSERT INTO discount_codes (code, discount_type, discount_value, min_purchase, max_uses, valid_until)
VALUES ('WELCOME10', 'percentage', 10, 0, 1000, now() + interval '1 year')
ON CONFLICT (code) DO NOTHING;
