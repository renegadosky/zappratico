
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS theme_color text DEFAULT '#10b981',
  ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS font_family text DEFAULT 'sans',
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS hours_json jsonb,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS tiktok_url text,
  ADD COLUMN IF NOT EXISTS contact_buttons jsonb DEFAULT '{"whatsapp":true,"instagram":false,"call":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS template_slug text DEFAULT 'classic';
