ALTER TABLE public.lua_recordings
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS likes integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.lua_recording_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id uuid NOT NULL REFERENCES public.lua_recordings(id) ON DELETE CASCADE,
  liker_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recording_id, liker_key)
);

GRANT SELECT ON public.lua_recording_likes TO anon;
GRANT SELECT ON public.lua_recording_likes TO authenticated;
GRANT ALL ON public.lua_recording_likes TO service_role;

ALTER TABLE public.lua_recording_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view recording likes" ON public.lua_recording_likes;
CREATE POLICY "Anyone can view recording likes"
ON public.lua_recording_likes
FOR SELECT
USING (true);

CREATE INDEX IF NOT EXISTS idx_lua_recordings_pinned_likes
ON public.lua_recordings (pinned DESC, likes DESC, updated_at DESC);

CREATE OR REPLACE FUNCTION public.recalc_recording_likes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
BEGIN
  rid := COALESCE(NEW.recording_id, OLD.recording_id);
  UPDATE public.lua_recordings
  SET likes = (SELECT count(*) FROM public.lua_recording_likes WHERE recording_id = rid)
  WHERE id = rid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_recording_likes ON public.lua_recording_likes;
CREATE TRIGGER trg_recalc_recording_likes
AFTER INSERT OR DELETE ON public.lua_recording_likes
FOR EACH ROW EXECUTE FUNCTION public.recalc_recording_likes();