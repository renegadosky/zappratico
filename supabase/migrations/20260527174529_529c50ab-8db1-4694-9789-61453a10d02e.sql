
-- 1. Drop unused anon SELECT policy on bots
DROP POLICY IF EXISTS "Public can view bots with enabled store" ON public.bots;

-- 2. Restrict anon column access on whatsapp_settings to only storefront-safe columns
REVOKE ALL ON public.whatsapp_settings FROM anon;
GRANT SELECT (bot_id, phone_number, store_title, store_description, buy_message_template, store_slug, store_enabled, use_native_catalog) ON public.whatsapp_settings TO anon;

-- Keep authenticated full access (RLS still restricts rows to owner OR enabled stores)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_settings TO authenticated;

-- 3. Remove subscriptions from realtime publication to prevent cross-user broadcast leaks
ALTER PUBLICATION supabase_realtime DROP TABLE public.subscriptions;
