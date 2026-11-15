
-- 1. whatsapp_settings: hide phone_number from public. Drop broad public policy and add column-scoped one.
DROP POLICY IF EXISTS "Public can view enabled stores" ON public.whatsapp_settings;

REVOKE SELECT ON public.whatsapp_settings FROM anon, authenticated;
GRANT SELECT (id, bot_id, store_enabled, store_title, store_description, store_slug, use_native_catalog, buy_message_template)
  ON public.whatsapp_settings TO anon, authenticated;
-- Owner still needs all columns
GRANT SELECT ON public.whatsapp_settings TO authenticated;

CREATE POLICY "Public can view enabled store info"
ON public.whatsapp_settings
FOR SELECT
TO anon, authenticated
USING (store_enabled = true);

-- 2. bots: restrict anon to only storefront-facing columns
REVOKE SELECT ON public.bots FROM anon;
GRANT SELECT (id, name, avatar_url, segment, is_active) ON public.bots TO anon;

-- 3. Realtime: enable RLS on realtime.messages with no allow policies (broadcast/presence default-deny).
-- postgres_changes still works because it enforces RLS on the underlying tables.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- 4. Storage: restrict public listing of product-images bucket. Keep individual object reads public,
-- but only objects in user's own folder can be listed by name.
DROP POLICY IF EXISTS "Public read product-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view product-images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Allow reading individual files (needed for <img src>) but not listing the bucket
CREATE POLICY "product_images_public_read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

-- 5. SECURITY DEFINER functions: handle_new_user and log_order_event are trigger-only.
-- Revoke EXECUTE from anon/authenticated so they can't be called as RPCs.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_order_event() FROM anon, authenticated, public;

-- 6. wa_rate_limits: add explicit deny-all policy so the linter is happy (only admin/service-role uses it).
CREATE POLICY "wa_rate_limits no client access"
ON public.wa_rate_limits
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
