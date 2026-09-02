CREATE POLICY "media_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'media');
CREATE POLICY "media_insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'media');
CREATE POLICY "media_update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'media');
CREATE POLICY "media_delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'media');