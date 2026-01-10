-- Create enums
CREATE TYPE public.ad_status AS ENUM ('pending', 'approved', 'rejected', 'sold');
CREATE TYPE public.price_type AS ENUM ('fixed', 'negotiable', 'free');
CREATE TYPE public.item_condition AS ENUM ('new', 'used');
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  division TEXT,
  district TEXT,
  area TEXT,
  avatar_url TEXT,
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table for admin role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create subcategories table
CREATE TABLE public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, slug)
);

-- Create ads table
CREATE TABLE public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  category_id UUID NOT NULL REFERENCES public.categories(id),
  subcategory_id UUID REFERENCES public.subcategories(id),
  price NUMERIC(12, 2),
  price_type price_type NOT NULL DEFAULT 'fixed',
  condition item_condition NOT NULL DEFAULT 'used',
  division TEXT NOT NULL,
  district TEXT NOT NULL,
  area TEXT,
  status ad_status NOT NULL DEFAULT 'pending',
  rejection_message TEXT,
  is_featured BOOLEAN DEFAULT false,
  views_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ad_images table
CREATE TABLE public.ad_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create favorites table
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_id UUID NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, ad_id)
);

-- Create reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_id UUID NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create function to check if user has role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ads_updated_at
  BEFORE UPDATE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- User Roles RLS Policies
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Categories RLS Policies
CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Subcategories RLS Policies
CREATE POLICY "Subcategories are viewable by everyone" ON public.subcategories FOR SELECT USING (true);
CREATE POLICY "Admins can manage subcategories" ON public.subcategories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Ads RLS Policies
CREATE POLICY "Approved ads are viewable by everyone" ON public.ads FOR SELECT USING (status = 'approved' OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own ads" ON public.ads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ads" ON public.ads FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own ads" ON public.ads FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Ad Images RLS Policies
CREATE POLICY "Ad images are viewable by everyone" ON public.ad_images FOR SELECT USING (true);
CREATE POLICY "Users can insert images for own ads" ON public.ad_images FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.ads WHERE id = ad_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own ad images" ON public.ad_images FOR DELETE USING (EXISTS (SELECT 1 FROM public.ads WHERE id = ad_id AND user_id = auth.uid()));

-- Favorites RLS Policies
CREATE POLICY "Users can view own favorites" ON public.favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add favorites" ON public.favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON public.favorites FOR DELETE USING (auth.uid() = user_id);

-- Reports RLS Policies
CREATE POLICY "Admins can view all reports" ON public.reports FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage reports" ON public.reports FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Insert default categories
INSERT INTO public.categories (name, slug, icon, sort_order) VALUES
  ('Electronics', 'electronics', 'Smartphone', 1),
  ('Vehicles', 'vehicles', 'Car', 2),
  ('Property', 'property', 'Home', 3),
  ('Jobs', 'jobs', 'Briefcase', 4),
  ('Fashion', 'fashion', 'Shirt', 5),
  ('Services', 'services', 'Wrench', 6),
  ('Furniture', 'furniture', 'Sofa', 7),
  ('Education', 'education', 'GraduationCap', 8);

-- Insert subcategories
INSERT INTO public.subcategories (category_id, name, slug) 
SELECT id, 'Mobile Phones', 'mobile-phones' FROM public.categories WHERE slug = 'electronics';
INSERT INTO public.subcategories (category_id, name, slug) 
SELECT id, 'Laptops', 'laptops' FROM public.categories WHERE slug = 'electronics';
INSERT INTO public.subcategories (category_id, name, slug) 
SELECT id, 'TVs', 'tvs' FROM public.categories WHERE slug = 'electronics';
INSERT INTO public.subcategories (category_id, name, slug) 
SELECT id, 'Cars', 'cars' FROM public.categories WHERE slug = 'vehicles';
INSERT INTO public.subcategories (category_id, name, slug) 
SELECT id, 'Motorcycles', 'motorcycles' FROM public.categories WHERE slug = 'vehicles';
INSERT INTO public.subcategories (category_id, name, slug) 
SELECT id, 'Apartments', 'apartments' FROM public.categories WHERE slug = 'property';
INSERT INTO public.subcategories (category_id, name, slug) 
SELECT id, 'Land', 'land' FROM public.categories WHERE slug = 'property';

-- Create storage bucket for ad images
INSERT INTO storage.buckets (id, name, public) VALUES ('ad-images', 'ad-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies for ad-images
CREATE POLICY "Ad images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'ad-images');
CREATE POLICY "Authenticated users can upload ad images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ad-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own ad images" ON storage.objects FOR DELETE USING (bucket_id = 'ad-images' AND auth.role() = 'authenticated');

-- Storage policies for avatars
CREATE POLICY "Avatars are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);