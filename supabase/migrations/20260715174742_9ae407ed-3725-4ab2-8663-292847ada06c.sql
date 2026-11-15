
DROP POLICY IF EXISTS "Public can view enabled store info" ON public.whatsapp_settings;

CREATE OR REPLACE VIEW public.public_store_info
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  bot_id, phone_number, store_title, store_description,
  buy_message_template, store_slug, store_enabled,
  use_native_catalog, logo_url, cover_url, theme_color,
  accent_color, font_family, address, hours_json,
  instagram_url, tiktok_url, contact_buttons
FROM public.whatsapp_settings
WHERE store_enabled = true;

GRANT SELECT ON public.public_store_info TO anon, authenticated;
