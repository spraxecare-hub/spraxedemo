/*
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