
DROP VIEW IF EXISTS public.public_store_info;

-- Restore anon SELECT policy but restrict columns via column-level grants
CREATE POLICY "Public can view enabled store info"
ON public.whatsapp_settings
FOR SELECT
TO anon
USING (store_enabled = true);

REVOKE SELECT ON public.whatsapp_settings FROM anon;
GRANT SELECT (
  bot_id, phone_number, store_title, store_description,
  buy_message_template, store_slug, store_enabled,
  use_native_catalog, logo_url, cover_url, theme_color,
  accent_color, font_family, address, hours_json,
  instagram_url, tiktok_url, contact_buttons
) ON public.whatsapp_settings TO anon;
