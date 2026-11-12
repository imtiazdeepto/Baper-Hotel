-- ============================================================
-- RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
-- Supabase Storage Setup & Security Policies
-- Bucket: food-images
-- ============================================================

-- 1. Create the food-images bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'food-images',
    'food-images',
    TRUE,
    2097152, -- 2MB file size limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = TRUE,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Storage Policies for food-images bucket

-- Allow public read access to all images in food-images bucket
DROP POLICY IF EXISTS "Public can view food images" ON storage.objects;
CREATE POLICY "Public can view food images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'food-images');

-- Allow only authenticated Admins to upload images
DROP POLICY IF EXISTS "Admin can upload food images" ON storage.objects;
CREATE POLICY "Admin can upload food images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'food-images'
        AND public.is_admin()
    );

-- Allow only Admins to update images
DROP POLICY IF EXISTS "Admin can update food images" ON storage.objects;
CREATE POLICY "Admin can update food images"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'food-images'
        AND public.is_admin()
    );

-- Allow only Admins to delete images
DROP POLICY IF EXISTS "Admin can delete food images" ON storage.objects;
CREATE POLICY "Admin can delete food images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'food-images'
        AND public.is_admin()
    );
