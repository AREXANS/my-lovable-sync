ALTER TABLE public.lua_scripts ADD COLUMN IF NOT EXISTS key_system_mode text NOT NULL DEFAULT 'global';

CREATE TABLE IF NOT EXISTS public.lua_script_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES public.lua_scripts(id) ON DELETE CASCADE,
  key text NOT NULL,
  role text NOT NULL DEFAULT 'SCRIPT',
  max_hwid integer NOT NULL DEFAULT 1,
  hwids jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (script_id, key)
);

CREATE INDEX IF NOT EXISTS lua_script_keys_script_id_idx ON public.lua_script_keys (script_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lua_script_keys TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lua_script_keys TO authenticated;
GRANT ALL ON public.lua_script_keys TO service_role;

ALTER TABLE public.lua_script_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access lua_script_keys" ON public.lua_script_keys
FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER touch_lua_script_keys_updated_at
BEFORE UPDATE ON public.lua_script_keys
FOR EACH ROW EXECUTE FUNCTION public.touch_lua_recordings_updated_at();