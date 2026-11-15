-- ============ 1. Reembolso / conciliação em orders ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_status text,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_status text,
  ADD COLUMN IF NOT EXISTS last_reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconcile_attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS orders_reconcile_idx
  ON public.orders (status, payment_provider, created_at)
  WHERE provider_charge_id IS NOT NULL;

-- ============ 2. Histórico de eventos de pagamento ============
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  bot_id uuid,
  provider text,
  kind text NOT NULL,
  status text,
  amount_cents integer NOT NULL DEFAULT 0,
  message text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_events_select_own ON public.payment_events;
CREATE POLICY payment_events_select_own ON public.payment_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS payment_events_order_idx ON public.payment_events (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_user_idx ON public.payment_events (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_payment_events_updated_at ON public.payment_events;
CREATE TRIGGER update_payment_events_updated_at BEFORE UPDATE ON public.payment_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 3. Provedor preferido do usuário ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_payment_provider text;

-- ============ 4. Visão pública da mini-loja ============
DROP VIEW IF EXISTS public.public_stores;
CREATE VIEW public.public_stores
WITH (security_invoker = false) AS
  SELECT ws.bot_id, ws.store_slug, ws.phone_number, ws.store_title, ws.store_description,
         ws.buy_message_template, ws.logo_url, ws.cover_url, ws.theme_color, ws.accent_color,
         ws.font_family, ws.address, ws.hours_json, ws.instagram_url, ws.tiktok_url,
         ws.contact_buttons
  FROM public.whatsapp_settings ws
  WHERE ws.store_enabled = true AND ws.store_slug IS NOT NULL;

GRANT SELECT ON public.public_stores TO anon, authenticated;

-- ============ 5. Privacidade: remove políticas abertas a visitantes ============
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ('anon' = ANY (roles) OR 'public' = ANY (roles))
      AND tablename IN ('bots','bot_flows','conversations','messages','orders','order_events',
                        'payment_settings','whatsapp_settings','whatsapp_credentials','stores',
                        'subscriptions','platform_fee_ledger','platform_settings','profiles',
                        'user_roles','wa_rate_limits','products','menus','menu_items')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ============ 6. Políticas por dono ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bots','bot_flows','conversations','messages','orders','order_events',
                           'payment_settings','whatsapp_settings','whatsapp_credentials','stores',
                           'products','menus','menu_items']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'owner_all_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
      'owner_all_' || t, t);
  END LOOP;
END $$;

-- leitura pública restrita: catálogo de lojas publicadas
GRANT SELECT ON public.products, public.menus, public.menu_items TO anon;

DROP POLICY IF EXISTS products_public_store_read ON public.products;
CREATE POLICY products_public_store_read ON public.products
  FOR SELECT TO anon USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.whatsapp_settings ws
      WHERE ws.bot_id = products.bot_id AND ws.store_enabled = true
    )
  );

DROP POLICY IF EXISTS menus_public_store_read ON public.menus;
CREATE POLICY menus_public_store_read ON public.menus
  FOR SELECT TO anon USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.whatsapp_settings ws
      WHERE ws.bot_id = menus.bot_id AND ws.store_enabled = true
    )
  );

DROP POLICY IF EXISTS menu_items_public_store_read ON public.menu_items;
CREATE POLICY menu_items_public_store_read ON public.menu_items
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.menus m
      JOIN public.whatsapp_settings ws ON ws.bot_id = m.bot_id
      WHERE m.id = menu_items.menu_id AND m.is_active = true AND ws.store_enabled = true
    )
  );

-- ============ 7. Tabelas de conta ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
DROP POLICY IF EXISTS profiles_own ON public.profiles;
CREATE POLICY profiles_own ON public.profiles
  FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscriptions FROM anon;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.platform_fee_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_fee_ledger FROM anon;
GRANT SELECT ON public.platform_fee_ledger TO authenticated;
GRANT ALL ON public.platform_fee_ledger TO service_role;
DROP POLICY IF EXISTS fee_ledger_select_own ON public.platform_fee_ledger;
CREATE POLICY fee_ledger_select_own ON public.platform_fee_ledger
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS fee_ledger_admin_read ON public.platform_fee_ledger;
CREATE POLICY fee_ledger_admin_read ON public.platform_fee_ledger
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_roles FROM anon;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_settings FROM anon;
GRANT SELECT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
DROP POLICY IF EXISTS platform_settings_admin ON public.platform_settings;
CREATE POLICY platform_settings_admin ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.wa_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_rate_limits FROM anon, authenticated;
GRANT ALL ON public.wa_rate_limits TO service_role;