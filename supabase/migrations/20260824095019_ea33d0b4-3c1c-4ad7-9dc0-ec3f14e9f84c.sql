ALTER TABLE public.lua_scripts
  ADD COLUMN IF NOT EXISTS obfuscate_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS plain_content text;