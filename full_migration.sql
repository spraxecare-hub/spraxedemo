/*
  # Spraxe B2B E-Commerce Platform - Initial Schema

  ## Overview
  Complete database schema for a B2B wholesale e-commerce platform targeting Bangladesh market.

  ## New Tables

  ### 1. profiles
  - `id` (uuid, FK to auth.users) - User profile ID
  - `phone` (text, unique) - Bangladeshi phone number
  - `phone_verified` (boolean) - Phone verification status
  - `email_verified` (boolean) - Email verification status
  - `full_name` (text) - User's full name
  - `company_name` (text) - Business/company name
  - `business_type` (text) - Type of business (retailer, wholesaler, etc)
  - `role` (text) - User role: 'customer' or 'admin'
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. categories
  - `id` (uuid, PK)
  - `name` (text) - Category name
  - `slug` (text, unique) - URL-friendly slug
  - `description` (text) - Category description
  - `parent_id` (uuid, FK) - For subcategories
  - `image_url` (text) - Category image
  - `is_active` (boolean)
  - `sort_order` (integer)
  - `created_at` (timestamptz)

  ### 3. products
  - `id` (uuid, PK)
  - `category_id` (uuid, FK)
  - `name` (text) - Product name
  - `slug` (text, unique) - URL-friendly slug
  - `description` (text) - Product description
  - `sku` (text, unique) - Stock keeping unit
  - `manufacturer_sku` (text) - Manufacturer SKU (Phase 2)
  - `images` (jsonb) - Array of image URLs
  - `base_price` (decimal) - Base wholesale price
  - `retail_price` (decimal) - Suggested retail price
  - `stock_quantity` (integer)
  - `min_order_quantity` (integer) - Minimum order qty
  - `unit` (text) - Unit (pieces, kg, liter, etc)
  - `is_active` (boolean)
  - `is_featured` (boolean)
  - `supplier_name` (text) - Third-party supplier (Phase 1)
  - `tags` (text[]) - Search tags
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. tier_pricing
  - `id` (uuid, PK)
  - `product_id` (uuid, FK)
  - `min_quantity` (integer) - Minimum quantity for tier
  - `max_quantity` (integer) - Maximum quantity (null = unlimited)
  - `price` (decimal) - Price per unit at this tier
  - `created_at` (timestamptz)

  ### 5. addresses
  - `id` (uuid, PK)
  - `user_id` (uuid, FK)
  - `label` (text) - Home, Office, Warehouse, etc
  - `full_name` (text)
  - `phone` (text)
  - `address_line1` (text)
  - `address_line2` (text)
  - `city` (text)
  - `district` (text)
  - `postal_code` (text)
  - `is_default` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. cart_items
  - `id` (uuid, PK)
  - `user_id` (uuid, FK)
  - `product_id` (uuid, FK)
  - `quantity` (integer)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. orders
  - `id` (uuid, PK)
  - `order_number` (text, unique) - Human-readable order number
  - `user_id` (uuid, FK)
  - `status` (text) - pending, confirmed, processing, shipped, delivered, cancelled, refund_requested, refunded
  - `subtotal` (decimal)
  - `discount` (decimal)
  - `shipping_cost` (decimal)
  - `total` (decimal)
  - `payment_status` (text) - pending, paid, failed, refunded
  - `payment_method` (text) - card, mobile_banking, internet_banking
  - `payment_transaction_id` (text)
  - `shipping_address_id` (uuid, FK)
  - `notes` (text) - Customer notes
  - `admin_notes` (text) - Internal admin notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 8. order_items
  - `id` (uuid, PK)
  - `order_id` (uuid, FK)
  - `product_id` (uuid, FK)
  - `product_name` (text) - Snapshot at order time
  - `product_sku` (text)
  - `quantity` (integer)
  - `unit_price` (decimal)
  - `total_price` (decimal)
  - `created_at` (timestamptz)

  ### 9. support_tickets
  - `id` (uuid, PK)
  - `ticket_number` (text, unique)
  - `user_id` (uuid, FK)
  - `type` (text) - complaint, refund, issue, inquiry
  - `subject` (text)
  - `message` (text)
  - `status` (text) - open, in_progress, resolved, closed
  - `priority` (text) - low, medium, high
  - `order_id` (uuid, FK, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 10. site_settings
  - `id` (uuid, PK)
  - `key` (text, unique) - Setting key
  - `value` (jsonb) - Setting value
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Customers can read active products and categories
  - Customers can manage their own profile, cart, orders, addresses
  - Admins have full access to everything
  - Public read access to active products and categories
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE,
  phone_verified boolean DEFAULT false,
  email_verified boolean DEFAULT false,
  full_name text NOT NULL,
  company_name text,
  business_type text,
  role text DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  image_url text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active categories"
  ON categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
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

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  sku text UNIQUE NOT NULL,
  manufacturer_sku text,
  images jsonb DEFAULT '[]'::jsonb,
  base_price decimal(10,2) NOT NULL,
  retail_price decimal(10,2),
  stock_quantity integer DEFAULT 0,
  min_order_quantity integer DEFAULT 1,
  unit text DEFAULT 'pieces',
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  supplier_name text,
  tags text[] DEFAULT '{}'::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage products"
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

-- Create tier_pricing table
CREATE TABLE IF NOT EXISTS tier_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL,
  max_quantity integer,
  price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tier_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tier pricing"
  ON tier_pricing FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage tier pricing"
  ON tier_pricing FOR ALL
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

-- Create addresses table
CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  label text DEFAULT 'Home',
  full_name text NOT NULL,
  phone text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  district text NOT NULL,
  postal_code text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own addresses"
  ON addresses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own addresses"
  ON addresses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses"
  ON addresses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
  ON addresses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create cart_items table
CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cart"
  ON cart_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own cart"
  ON cart_items FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refund_requested', 'refunded')),
  subtotal decimal(10,2) NOT NULL,
  discount decimal(10,2) DEFAULT 0,
  shipping_cost decimal(10,2) DEFAULT 0,
  total decimal(10,2) NOT NULL,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_method text,
  payment_transaction_id text,
  shipping_address_id uuid REFERENCES addresses(id) ON DELETE SET NULL,
  notes text,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_sku text NOT NULL,
  quantity integer NOT NULL,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('complaint', 'refund', 'issue', 'inquiry')),
  subject text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage tickets"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site settings"
  ON site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage site settings"
  ON site_settings FOR ALL
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- Insert default site settings
INSERT INTO site_settings (key, value) VALUES
  ('chat_provider', '{"type": "messenger", "enabled": true}'::jsonb),
  ('shipping_cost', '{"flat_rate": 60, "free_above": 5000}'::jsonb),
  ('business_info', '{"name": "Spraxe", "email": "support@spraxe.com", "phone": "+880 1XXXXXXXXX"}'::jsonb)
ON CONFLICT (key) DO NOTHING;/*
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
ON CONFLICT (slug) DO NOTHING;/*
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
/*
  # Add Phone Authentication Support

  ## Overview
  Update profiles table to support phone-based authentication and store phone numbers.

  ## Changes

  ### 1. Update profiles table
  - Add `phone` column for storing phone numbers
  - Make phone unique to prevent duplicate registrations
  - Update policies to support phone-based authentication

  ### 2. Security
  - Maintain existing RLS policies
  - Ensure phone numbers are protected
*/

-- Add phone column to profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
    ALTER TABLE profiles ADD COLUMN phone text UNIQUE;
  END IF;
END $$;

-- Create index for faster phone lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- Function to automatically create profile for phone auth users
CREATE OR REPLACE FUNCTION public.handle_phone_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    'customer',
    NEW.phone
  )
  ON CONFLICT (id) DO UPDATE
  SET phone = EXCLUDED.phone;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for phone auth users
DROP TRIGGER IF EXISTS on_phone_auth_user_created ON auth.users;
CREATE TRIGGER on_phone_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.phone IS NOT NULL)
  EXECUTE FUNCTION public.handle_phone_auth_user();
/*
  # Fix Security and Performance Issues

  This migration addresses critical database security and performance issues:

  ## 1. Add Missing Foreign Key Indexes
  - Creates indexes on foreign key columns to improve join performance
  - Affects: order_items, orders, seller_applications, support_tickets

  ## 2. Optimize RLS Policies
  - Replaces `auth.uid()` with `(select auth.uid())` in all RLS policies
  - Prevents function re-evaluation for each row, dramatically improving query performance
  - Affects all tables with RLS policies

  ## 3. Remove Duplicate RLS Policies
  - Removes redundant policies that create multiple permissive rules
  - Keeps the most specific and secure policy for each action
  - Simplifies security model and improves performance

  ## 4. Fix Function Search Path
  - Sets immutable search_path for database functions to prevent security issues
*/

-- ============================================================================
-- PART 1: Add Missing Foreign Key Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_order_items_product_fk 
  ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_orders_shipping_address_fk 
  ON orders(shipping_address_id);

CREATE INDEX IF NOT EXISTS idx_seller_applications_user_fk 
  ON seller_applications(user_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_order_fk 
  ON support_tickets(order_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_fk 
  ON support_tickets(user_id);

-- ============================================================================
-- PART 2: Drop and Recreate Optimized RLS Policies
-- ============================================================================

-- PROFILES TABLE
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ADDRESSES TABLE
DROP POLICY IF EXISTS "Users can view own addresses" ON addresses;
DROP POLICY IF EXISTS "Users can insert own addresses" ON addresses;
DROP POLICY IF EXISTS "Users can update own addresses" ON addresses;
DROP POLICY IF EXISTS "Users can delete own addresses" ON addresses;

CREATE POLICY "Users can view own addresses"
  ON addresses FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own addresses"
  ON addresses FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own addresses"
  ON addresses FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own addresses"
  ON addresses FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- CART_ITEMS TABLE - Remove duplicates, keep specific policies
DROP POLICY IF EXISTS "Users can view own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can insert own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can update own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can delete own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can manage own cart" ON cart_items;
DROP POLICY IF EXISTS "Users can view own cart" ON cart_items;

CREATE POLICY "Users can view own cart items"
  ON cart_items FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own cart items"
  ON cart_items FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own cart items"
  ON cart_items FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own cart items"
  ON cart_items FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- PRODUCTS TABLE
DROP POLICY IF EXISTS "Sellers can view own products" ON products;
DROP POLICY IF EXISTS "Sellers can insert products" ON products;
DROP POLICY IF EXISTS "Sellers can update own products" ON products;
DROP POLICY IF EXISTS "Admins can manage all products" ON products;

CREATE POLICY "Sellers can view own products"
  ON products FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = seller_id);

CREATE POLICY "Sellers can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role IN ('seller', 'admin')
    )
  );

CREATE POLICY "Sellers can update own products"
  ON products FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = seller_id)
  WITH CHECK ((select auth.uid()) = seller_id);

CREATE POLICY "Admins can manage all products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- ORDERS TABLE
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can create orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage orders" ON orders;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage orders"
  ON orders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- ORDER_ITEMS TABLE
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
DROP POLICY IF EXISTS "Users can create order items" ON order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;

CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- CATEGORIES TABLE
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;

CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- SUPPORT_TICKETS TABLE
DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can manage tickets" ON support_tickets;

CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage tickets"
  ON support_tickets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- SELLER_APPLICATIONS TABLE
DROP POLICY IF EXISTS "Users can view own applications" ON seller_applications;
DROP POLICY IF EXISTS "Users can create applications" ON seller_applications;
DROP POLICY IF EXISTS "Admins can manage applications" ON seller_applications;

CREATE POLICY "Users can view own applications"
  ON seller_applications FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create applications"
  ON seller_applications FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage applications"
  ON seller_applications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- SITE_SETTINGS TABLE
DROP POLICY IF EXISTS "Admins can manage site settings" ON site_settings;

CREATE POLICY "Admins can manage site settings"
  ON site_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- DISCOUNT_CODES TABLE
DROP POLICY IF EXISTS "Admins can manage discount codes" ON discount_codes;

CREATE POLICY "Admins can manage discount codes"
  ON discount_codes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- ============================================================================
-- PART 3: Fix Function Search Path
-- ============================================================================

DROP FUNCTION IF EXISTS handle_phone_auth_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_phone_auth_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, full_name, role)
  VALUES (
    NEW.id,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_phone
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.phone IS NOT NULL)
  EXECUTE FUNCTION handle_phone_auth_user();/*
  # Add Invoice System

  This migration creates a comprehensive invoice system for orders.

  ## New Tables
  
  ### invoices
  - `id` (uuid, primary key) - Unique invoice identifier
  - `order_id` (uuid, foreign key) - Reference to orders table
  - `invoice_number` (text, unique) - Human-readable invoice number (INV-YYYYMMDD-XXXX)
  - `issue_date` (timestamptz) - When invoice was issued
  - `due_date` (timestamptz) - Payment due date
  - `subtotal` (numeric) - Sum of all items before tax/discount
  - `tax_amount` (numeric) - Total tax amount
  - `discount_amount` (numeric) - Total discount applied
  - `total_amount` (numeric) - Final amount to pay
  - `notes` (text) - Additional invoice notes
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record update timestamp

  ## Security
  - Enable RLS on invoices table
  - Users can view their own invoices
  - Admins can view and manage all invoices

  ## Functions
  - `generate_invoice_number()` - Auto-generates sequential invoice numbers
  - `create_invoice_for_order()` - Automatically creates invoice when order is created
*/

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE UNIQUE NOT NULL,
  invoice_number text UNIQUE NOT NULL,
  issue_date timestamptz DEFAULT now() NOT NULL,
  due_date timestamptz DEFAULT (now() + interval '7 days') NOT NULL,
  subtotal numeric(10,2) DEFAULT 0 NOT NULL,
  tax_amount numeric(10,2) DEFAULT 0 NOT NULL,
  discount_amount numeric(10,2) DEFAULT 0 NOT NULL,
  total_amount numeric(10,2) DEFAULT 0 NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create index on order_id
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);

-- Create index on invoice_number
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number text;
  date_part text;
  sequence_part int;
BEGIN
  date_part := to_char(now(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(CAST(substring(invoice_number from 14) AS int)), 0) + 1
  INTO sequence_part
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || date_part || '-%';
  
  new_number := 'INV-' || date_part || '-' || lpad(sequence_part::text, 4, '0');
  
  RETURN new_number;
END;
$$;

-- Function to create invoice for order
CREATE OR REPLACE FUNCTION create_invoice_for_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric(10,2);
  v_tax_amount numeric(10,2);
  v_discount_amount numeric(10,2);
  v_total_amount numeric(10,2);
BEGIN
  v_subtotal := NEW.subtotal;
  v_tax_amount := COALESCE(NEW.tax_amount, 0);
  v_discount_amount := COALESCE(NEW.discount_amount, 0);
  v_total_amount := NEW.total_amount;

  INSERT INTO invoices (
    order_id,
    invoice_number,
    subtotal,
    tax_amount,
    discount_amount,
    total_amount,
    notes
  ) VALUES (
    NEW.id,
    generate_invoice_number(),
    v_subtotal,
    v_tax_amount,
    v_discount_amount,
    v_total_amount,
    'Thank you for shopping with Spraxe!'
  );

  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate invoice on order creation
DROP TRIGGER IF EXISTS on_order_created_generate_invoice ON orders;
CREATE TRIGGER on_order_created_generate_invoice
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_invoice_for_order();

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Users can view their own invoices
CREATE POLICY "Users can view own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = invoices.order_id 
      AND orders.user_id = (select auth.uid())
    )
  );

-- Admins can view all invoices
CREATE POLICY "Admins can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- Admins can manage invoices
CREATE POLICY "Admins can manage invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );