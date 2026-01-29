/*
  # Create Featured Images Table

  1. New Tables
    - `featured_images`
      - `id` (integer, primary key)
      - `title` (text) - Title of the featured section
      - `description` (text) - Description text
      - `image_url` (text) - URL of the image
      - `sort_order` (integer) - Display order
      - `is_active` (boolean) - Whether to show this image
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `featured_images` table
    - Add policy for public read access (anyone can view featured images)
    - Add policy for admin-only write access

  3. Sample Data
    - Insert 3 default featured images
*/

CREATE TABLE IF NOT EXISTS featured_images (
  id serial PRIMARY KEY,
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE featured_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active featured images"
  ON featured_images
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can manage featured images"
  ON featured_images
  FOR ALL
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

INSERT INTO featured_images (title, description, image_url, sort_order) VALUES
  ('Electronics', 'Latest gadgets & devices', 'https://images.pexels.com/photos/335257/pexels-photo-335257.jpeg?auto=compress&cs=tinysrgb&w=800', 1),
  ('Fashion', 'Trending styles', 'https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=600', 2),
  ('Home & Kitchen', 'Quality essentials', 'https://images.pexels.com/photos/1350789/pexels-photo-1350789.jpeg?auto=compress&cs=tinysrgb&w=600', 3)
ON CONFLICT DO NOTHING;
