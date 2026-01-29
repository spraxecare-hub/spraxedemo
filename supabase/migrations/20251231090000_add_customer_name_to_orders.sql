-- Adds customer_name to orders for guest checkout + better invoices/admin views
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_name text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON public.orders(customer_name);
