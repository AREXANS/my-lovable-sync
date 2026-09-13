-- ============ SETTINGS & STORE ============
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage site settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  price_per_day INTEGER NOT NULL DEFAULT 2000,
  description TEXT,
  features TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO anon, authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage packages" ON public.packages FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  link TEXT,
  link_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads TO anon, authenticated;
GRANT ALL ON public.ads TO service_role;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage ads" ON public.ads FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.backgrounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  background_type TEXT NOT NULL DEFAULT 'image',
  background_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backgrounds TO anon, authenticated;
GRANT ALL ON public.backgrounds TO service_role;
ALTER TABLE public.backgrounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage backgrounds" ON public.backgrounds FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon_type TEXT NOT NULL DEFAULT 'link',
  url TEXT NOT NULL,
  label TEXT NOT NULL,
  link_location TEXT NOT NULL DEFAULT 'home',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_links TO anon, authenticated;
GRANT ALL ON public.social_links TO service_role;
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage social links" ON public.social_links FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_whatsapp TEXT,
  package_name TEXT NOT NULL,
  package_duration INTEGER NOT NULL,
  original_amount INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  license_key TEXT,
  qr_string TEXT,
  device_id TEXT,
  ip_address TEXT,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO anon, authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  device_name TEXT,
  device_info JSONB,
  login_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_current BOOLEAN NOT NULL DEFAULT true,
  is_approved BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_sessions TO anon, authenticated;
GRANT ALL ON public.admin_sessions TO service_role;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage admin sessions" ON public.admin_sessions FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.package_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_type TEXT NOT NULL DEFAULT 'duration_based',
  min_days INTEGER,
  max_days INTEGER,
  discount_percent NUMERIC NOT NULL DEFAULT 10,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  duration_exact BOOLEAN NOT NULL DEFAULT false,
  promo_code TEXT,
  package_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  description TEXT,
  notify_users BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_discounts TO anon, authenticated;
GRANT ALL ON public.package_discounts TO service_role;
ALTER TABLE public.package_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage discounts" ON public.package_discounts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_ips TO anon, authenticated;
GRANT ALL ON public.blocked_ips TO service_role;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage blocked ips" ON public.blocked_ips FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.duration_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  duration_days INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses_per_key INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  used_by JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duration_codes TO anon, authenticated;
GRANT ALL ON public.duration_codes TO service_role;
ALTER TABLE public.duration_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage duration codes" ON public.duration_codes FOR ALL USING (true) WITH CHECK (true);

-- ============ XCOINS ============
CREATE TABLE public.xcoins_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  display_name TEXT,
  balance INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.xcoins_balances TO anon, authenticated;
GRANT ALL ON public.xcoins_balances TO service_role;
ALTER TABLE public.xcoins_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read xcoins balances" ON public.xcoins_balances FOR SELECT USING (true);
CREATE POLICY "Service role can manage xcoins balances" ON public.xcoins_balances FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.xcoins_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.xcoins_balances(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'topup',
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.xcoins_transactions TO anon, authenticated;
GRANT ALL ON public.xcoins_transactions TO service_role;
ALTER TABLE public.xcoins_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read xcoins transactions" ON public.xcoins_transactions FOR SELECT USING (true);
CREATE POLICY "Service role can manage xcoins transactions" ON public.xcoins_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.xcoins_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.xcoins_otp TO service_role;
ALTER TABLE public.xcoins_otp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage otp" ON public.xcoins_otp FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.xcoins_transactions;

-- ============ LUA SCRIPTS ============
CREATE TABLE public.lua_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL DEFAULT '',
  backup_content TEXT,
  raw_content TEXT,
  plain_content TEXT,
  script_type TEXT NOT NULL DEFAULT 'main',
  category TEXT NOT NULL DEFAULT 'umum',
  obfuscate_enabled BOOLEAN NOT NULL DEFAULT false,
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lua_scripts TO anon, authenticated;
GRANT ALL ON public.lua_scripts TO service_role;
ALTER TABLE public.lua_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage lua scripts" ON public.lua_scripts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.lua_script_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.lua_scripts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lua_script_versions_script_id ON public.lua_script_versions(script_id, version_number DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lua_script_versions TO anon, authenticated;
GRANT ALL ON public.lua_script_versions TO service_role;
ALTER TABLE public.lua_script_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access lua_script_versions" ON public.lua_script_versions FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.snapshot_lua_script_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_version INTEGER;
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
      FROM public.lua_script_versions WHERE script_id = OLD.id;
    INSERT INTO public.lua_script_versions (script_id, version_number, content, display_name)
    VALUES (OLD.id, next_version, OLD.content, OLD.display_name);
    DELETE FROM public.lua_script_versions
    WHERE script_id = OLD.id
      AND id NOT IN (
        SELECT id FROM public.lua_script_versions
        WHERE script_id = OLD.id
        ORDER BY version_number DESC
        LIMIT 20
      );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lua_script_snapshot
BEFORE UPDATE ON public.lua_scripts
FOR EACH ROW EXECUTE FUNCTION public.snapshot_lua_script_version();

-- ============ RECORDINGS & TELEPORTS ============
CREATE TABLE public.lua_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  owner_username TEXT,
  owner_key TEXT,
  owner_hwid TEXT,
  game_id TEXT,
  recording_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT false,
  duration_seconds INTEGER,
  pinned BOOLEAN NOT NULL DEFAULT false,
  likes INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'main_lua',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.lua_recordings TO service_role;
ALTER TABLE public.lua_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct client read lua recordings" ON public.lua_recordings FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Backend can manage lua recordings" ON public.lua_recordings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_lua_recordings_public_created ON public.lua_recordings (is_public, created_at DESC);
CREATE INDEX idx_lua_recordings_owner_key_created ON public.lua_recordings (owner_key, created_at DESC) WHERE owner_key IS NOT NULL;
CREATE INDEX idx_lua_recordings_pinned_likes ON public.lua_recordings (pinned DESC, likes DESC, updated_at DESC);

CREATE OR REPLACE FUNCTION public.touch_lua_recordings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER touch_lua_recordings_updated_at
BEFORE UPDATE ON public.lua_recordings
FOR EACH ROW EXECUTE FUNCTION public.touch_lua_recordings_updated_at();

CREATE TABLE public.lua_recording_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL,
  title TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  event_type TEXT NOT NULL DEFAULT 'upsert',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lua_recording_events TO anon, authenticated;
GRANT ALL ON public.lua_recording_events TO service_role;
ALTER TABLE public.lua_recording_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read public lua recording events" ON public.lua_recording_events FOR SELECT TO anon, authenticated USING (is_public = true);
CREATE POLICY "Backend can manage lua recording events" ON public.lua_recording_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.emit_lua_recording_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_public = true THEN
    INSERT INTO public.lua_recording_events (recording_id, title, is_public, event_type)
    VALUES (NEW.id, NEW.title, NEW.is_public, TG_OP);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER emit_lua_recording_event_trigger
AFTER INSERT OR UPDATE ON public.lua_recordings
FOR EACH ROW EXECUTE FUNCTION public.emit_lua_recording_event();

CREATE TABLE public.lua_recording_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES public.lua_recordings(id) ON DELETE CASCADE,
  liker_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recording_id, liker_key)
);
GRANT SELECT ON public.lua_recording_likes TO anon, authenticated;
GRANT ALL ON public.lua_recording_likes TO service_role;
ALTER TABLE public.lua_recording_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view recording likes" ON public.lua_recording_likes FOR SELECT USING (true);
ALTER TABLE public.lua_recording_likes REPLICA IDENTITY FULL;

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
REVOKE EXECUTE ON FUNCTION public.recalc_recording_likes() FROM anon, authenticated, PUBLIC;

CREATE TRIGGER trg_recalc_recording_likes
AFTER INSERT OR DELETE ON public.lua_recording_likes
FOR EACH ROW EXECUTE FUNCTION public.recalc_recording_likes();

CREATE TABLE public.lua_teleports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  owner_username TEXT,
  owner_key TEXT,
  owner_hwid TEXT,
  game_id TEXT,
  teleport_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'main_lua',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lua_teleports TO anon, authenticated;
GRANT ALL ON public.lua_teleports TO service_role;
ALTER TABLE public.lua_teleports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read public teleports" ON public.lua_teleports FOR SELECT USING (is_public = true);
CREATE INDEX idx_lua_teleports_owner_key ON public.lua_teleports(owner_key);
CREATE INDEX idx_lua_teleports_game_id ON public.lua_teleports(game_id);
CREATE INDEX idx_lua_teleports_updated_at ON public.lua_teleports(updated_at DESC);
CREATE TRIGGER touch_lua_teleports_updated_at
BEFORE UPDATE ON public.lua_teleports
FOR EACH ROW EXECUTE FUNCTION public.touch_lua_recordings_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.lua_recordings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lua_recording_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lua_recording_likes;

-- ============ SEED ============
INSERT INTO public.packages (name, display_name, price_per_day, description, features, sort_order) VALUES
  ('NORMAL', 'NORMAL', 2000, 'Paket standar dengan semua fitur dasar', ARRAY['Semua fitur dasar', 'Update berkala', 'Support all executor'], 1),
  ('VIP', 'VIP', 3000, 'Paket premium dengan fitur eksklusif', ARRAY['Semua fitur Normal', 'Premium scripts', 'Priority support', 'Early access features'], 2);

INSERT INTO public.app_settings (key, value, description) VALUES
  ('admin_key', 'arexanstools2025@', 'Admin panel password'),
  ('loadstring_script', 'loadstring(game:HttpGet("https://tools.arexans.my.id/api/get-script?name=keysystem"))()', 'Script loadstring untuk executor'),
  ('cashify_license_key', '', 'License Key dari Cashify'),
  ('cashify_qris_id', '', 'QRIS ID untuk merchant'),
  ('cashify_webhook_key', '', 'Webhook Key untuk validasi callback'),
  ('cashify_api_key', '', 'API Key sistem Cashify'),
  ('discord_webhook_url', '', 'URL Webhook Discord untuk notifikasi'),
  ('payment_mode', 'demo', 'Mode pembayaran: demo atau live'),
  ('payment_simulation', 'off', 'Toggle simulasi pembayaran untuk testing (on/off)'),
  ('license_keys', '[]', 'Daftar license key aktif');

INSERT INTO public.lua_scripts (name, display_name, description, content, script_type, category, is_active) VALUES
  ('keysystem', 'Key System Loader', 'Script keysystem yang berisi UI input key dan validasi API', '-- Key System Loader', 'loader', 'umum', true),
  ('main', 'Main Script', 'Script utama yang dijalankan setelah validasi key berhasil', '-- Main Script', 'main', 'umum', true),
  ('library', 'UI Library', 'Library Lua untuk UI komponen', '-- UI Library', 'library', 'umum', true);