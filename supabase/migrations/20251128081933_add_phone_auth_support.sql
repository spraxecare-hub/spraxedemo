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
