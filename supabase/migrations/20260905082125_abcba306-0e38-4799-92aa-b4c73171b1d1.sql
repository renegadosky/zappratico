ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS secondary_color text,
  ADD COLUMN IF NOT EXISTS text_color text,
  ADD COLUMN IF NOT EXISTS button_style text NOT NULL DEFAULT 'rounded',
  ADD COLUMN IF NOT EXISTS layout_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS require_address boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accept_orders boolean NOT NULL DEFAULT true;