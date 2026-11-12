-- ============================================================
-- BAPER HOTEL — SUPABASE AUTH & ADMIN SETUP SCRIPT
-- Run this in your Supabase Dashboard SQL Editor
-- ============================================================

-- 1. Ensure authenticated users can create their own profile row
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles 
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- 2. Update trigger to safely handle profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        NEW.raw_user_meta_data->>'phone',
        'customer'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Sync all existing users from auth.users to public.profiles
INSERT INTO public.profiles (id, full_name, email, role)
SELECT 
    id,
    COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
    email,
    'customer'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. Set your Admin account role:
-- Replace 'admin@baperhotel.com' with your actual registered email address
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@baperhotel.com';

-- 5. Verification query: Run this to see all users and their assigned roles
SELECT id, full_name, email, role, created_at FROM public.profiles;
