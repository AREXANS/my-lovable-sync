ALTER TABLE public.lua_recording_likes REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lua_recording_likes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;