-- Sample Data for Spraxe B2B Platform
-- Run this in Supabase SQL Editor to populate with sample data

-- Insert Categories
INSERT INTO categories (name, slug, description, is_active, sort_order) VALUES
('Electronics', 'electronics', 'Electronic devices and accessories for wholesale', true, 1),
('Fashion & Apparel', 'fashion-apparel', 'Clothing, shoes, and fashion accessories', true, 2),
('Food & Beverage', 'food-beverage', 'Food products and beverages in bulk', true, 3),
('Home & Living', 'home-living', 'Furniture, home decor, and household items', true, 4),
('Health & Beauty', 'health-beauty', 'Health products and beauty items', true, 5),
('Office Supplies', 'office-supplies', 'Office equipment and stationery', true, 6)
ON CONFLICT (slug) DO NOTHING;

-- Get category IDs
DO $$
DECLARE
  electronics_id uuid;
  fashion_id uuid;
  food_id uuid;
  home_id uuid;
BEGIN
  SELECT id INTO electronics_id FROM categories WHERE slug = 'electronics';
  SELECT id INTO fashion_id FROM categories WHERE slug = 'fashion-apparel';
  SELECT id INTO food_id FROM categories WHERE slug = 'food-beverage';
  SELECT id INTO home_id FROM categories WHERE slug = 'home-living';

  -- Insert Sample Products
  INSERT INTO products (
    category_id, name, slug, description, sku, base_price, retail_price,
    stock_quantity, min_order_quantity, unit, is_active, is_featured
  ) VALUES
  -- Electronics
  (
    electronics_id,
    'Wireless Bluetooth Headphones - Bulk Pack',
    'wireless-bluetooth-headphones-bulk',
    'High-quality wireless headphones perfect for retail. Features noise cancellation and 20-hour battery life.',
    'ELEC-WBH-001',
    1200.00,
    1800.00,
    500,
    10,
    'pieces',
    true,
    true
  ),
  (
    electronics_id,
    'USB-C Charging Cables - 100 Pack',
    'usbc-charging-cables-100pack',
    'Durable USB-C charging cables, 1 meter length. Perfect for resellers.',
    'ELEC-USBC-002',
    150.00,
    250.00,
    1000,
    50,
    'pieces',
    true,
    true
  ),
  (
    electronics_id,
    'Power Bank 10000mAh - Wholesale',
    'power-bank-10000mah-wholesale',
    'Compact portable charger with dual USB ports. Fast charging supported.',
    'ELEC-PB-003',
    800.00,
    1200.00,
    300,
    20,
    'pieces',
    true,
    false
  ),
  -- Fashion
  (
    fashion_id,
    'Cotton T-Shirts - Assorted Colors (Bulk)',
    'cotton-tshirts-bulk',
    'Premium quality cotton t-shirts in various sizes and colors. Perfect for retail stores.',
    'FASH-TS-001',
    250.00,
    450.00,
    2000,
    100,
    'pieces',
    true,
    true
  ),
  (
    fashion_id,
    'Denim Jeans - Wholesale Pack',
    'denim-jeans-wholesale',
    'High-quality denim jeans for men and women. Multiple sizes available.',
    'FASH-DJ-002',
    650.00,
    1100.00,
    800,
    50,
    'pieces',
    true,
    true
  ),
  -- Food & Beverage
  (
    food_id,
    'Premium Rice - 50kg Bags',
    'premium-rice-50kg',
    'High-quality Bangladeshi rice, perfect for restaurants and retailers.',
    'FOOD-RICE-001',
    2800.00,
    3200.00,
    200,
    5,
    'bags',
    true,
    true
  ),
  (
    food_id,
    'Instant Noodles - Carton of 40',
    'instant-noodles-carton',
    'Popular brand instant noodles, perfect for retail shops.',
    'FOOD-NOOD-002',
    480.00,
    640.00,
    500,
    10,
    'cartons',
    true,
    true
  ),
  -- Home & Living
  (
    home_id,
    'Plastic Storage Containers - Set of 10',
    'plastic-storage-containers-set',
    'Durable plastic storage containers in various sizes.',
    'HOME-PSC-001',
    850.00,
    1200.00,
    300,
    20,
    'sets',
    true,
    true
  )
  ON CONFLICT (sku) DO NOTHING;

END $$;

-- Insert tier pricing for sample products
DO $$
DECLARE
  product_record RECORD;
BEGIN
  FOR product_record IN SELECT id, base_price FROM products WHERE sku LIKE 'ELEC-WBH-001'
  LOOP
    INSERT INTO tier_pricing (product_id, min_quantity, max_quantity, price) VALUES
    (product_record.id, 10, 49, product_record.base_price),
    (product_record.id, 50, 99, product_record.base_price * 0.95),
    (product_record.id, 100, NULL, product_record.base_price * 0.90)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Update site settings
INSERT INTO site_settings (key, value) VALUES
('business_info', '{
  "name": "Spraxe",
  "email": "support@spraxe.com",
  "phone": "+880 1XXXXXXXXX",
  "address": "Dhaka, Bangladesh"
}'::jsonb),
('chat_provider', '{
  "type": "messenger",
  "enabled": true,
  "messenger_page_id": ""
}'::jsonb),
('shipping_cost', '{
  "flat_rate": 60,
  "free_above": 5000
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Success message
SELECT 'Sample data inserted successfully!' as message;
