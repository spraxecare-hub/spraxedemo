-- Adds a lightweight RPC for product filters (suppliers + tags)
-- This avoids scanning thousands of products on the client just to populate filter dropdowns.

CREATE OR REPLACE FUNCTION public.get_product_filter_options()
RETURNS TABLE (suppliers text[], tags text[])
LANGUAGE sql
STABLE
AS $$
  WITH eligible AS (
    SELECT supplier_name, tags
    FROM products
    WHERE is_active = true
      AND (approval_status = 'approved' OR approval_status IS NULL)
  )
  SELECT
    -- Suppliers
    (
      SELECT COALESCE(array_agg(DISTINCT btrim(supplier_name) ORDER BY btrim(supplier_name)), '{}'::text[])
      FROM eligible
      WHERE supplier_name IS NOT NULL
        AND btrim(supplier_name) <> ''
    ) AS suppliers,

    -- Tags (products.tags is text[])
    (
      SELECT COALESCE(array_agg(DISTINCT btrim(tag) ORDER BY btrim(tag)), '{}'::text[])
      FROM eligible e
      CROSS JOIN LATERAL unnest(COALESCE(e.tags, '{}'::text[])) AS tag
      WHERE tag IS NOT NULL
        AND btrim(tag) <> ''
    ) AS tags;
$$;

-- Allow calling from the client
GRANT EXECUTE ON FUNCTION public.get_product_filter_options() TO anon, authenticated;
