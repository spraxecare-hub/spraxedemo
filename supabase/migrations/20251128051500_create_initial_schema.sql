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
ON CONFLICT (key) DO NOTHING;