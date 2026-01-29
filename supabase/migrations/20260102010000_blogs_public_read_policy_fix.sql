/*
  # Fix public read policy for blogs

  Some Supabase setups expect policies to be scoped to `anon`/`authenticated`
  rather than `public`. This migration ensures anonymous visitors can read
  only published blog posts.
*/

ALTER TABLE IF EXISTS blogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published blogs" ON blogs;

CREATE POLICY "Anyone can view published blogs"
  ON blogs
  FOR SELECT
  TO anon
  USING (is_published = true);
