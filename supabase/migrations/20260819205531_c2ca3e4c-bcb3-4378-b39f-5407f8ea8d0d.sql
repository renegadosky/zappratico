DROP VIEW IF EXISTS public.public_stores;
CREATE VIEW public.public_stores
WITH (security_invoker = true) AS
  SELECT ws.bot_id, ws.store_slug, ws.phone_number, ws.store_title, ws.store_description,
         ws.buy_message_template, ws.logo_url, ws.cover_url, ws.theme_color, ws.accent_color,
         ws.font_family, ws.address, ws.hours_json, ws.instagram_url, ws.tiktok_url,
         ws.contact_buttons
  FROM public.whatsapp_settings ws
  WHERE ws.store_enabled = true AND ws.store_slug IS NOT NULL;

GRANT SELECT ON public.public_stores TO anon, authenticated;

-- visitantes: acesso apenas às colunas visuais da loja publicada
GRANT SELECT (bot_id, store_slug, phone_number, store_title, store_description,
              buy_message_template, logo_url, cover_url, theme_color, accent_color,
              font_family, address, hours_json, instagram_url, tiktok_url,
              contact_buttons, store_enabled)
  ON public.whatsapp_settings TO anon;

DROP POLICY IF EXISTS whatsapp_settings_public_store_read ON public.whatsapp_settings;
CREATE POLICY whatsapp_settings_public_store_read ON public.whatsapp_settings
  FOR SELECT TO anon USING (store_enabled = true AND store_slug IS NOT NULL);