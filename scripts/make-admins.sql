-- Update users to admin role based on email
-- This script grants admin access to specified email addresses

-- Update roni@spraxe.com to admin
UPDATE profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'roni@spraxe.com'
);

-- Update yeamin@spraxe.com to admin
UPDATE profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'yeamin@spraxe.com'
);

-- Verify the changes
SELECT
  u.email,
  p.full_name,
  p.role
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE u.email IN ('roni@spraxe.com', 'yeamin@spraxe.com');
