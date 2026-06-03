-- 1. First, make sure the bucket actually exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('agencyos_files', 'agencyos_files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop the old policies if they exist so we don't get the "already exists" error
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their files" ON storage.objects;

-- 3. Create the correct policies
CREATE POLICY "Allow authenticated users to upload files" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK ( bucket_id = 'agencyos_files' );

CREATE POLICY "Allow public read access" 
ON storage.objects FOR SELECT TO public 
USING ( bucket_id = 'agencyos_files' );

CREATE POLICY "Allow users to update their files"
ON storage.objects FOR UPDATE TO authenticated
USING ( bucket_id = 'agencyos_files' );

CREATE POLICY "Allow users to delete their files"
ON storage.objects FOR DELETE TO authenticated
USING ( bucket_id = 'agencyos_files' );
