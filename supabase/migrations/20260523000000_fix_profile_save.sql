-- Migration: Fix profiles check constraint and update RLS policies
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bio_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_check CHECK (char_length(bio) <= 160);

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Recreate SELECT and UPDATE policies to allow users to update their own profile
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
