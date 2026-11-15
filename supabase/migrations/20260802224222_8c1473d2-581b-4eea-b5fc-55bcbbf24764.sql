-- 1) Papéis de usuário (admin da plataforma)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- 2) Configurações da plataforma (singleton)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true,
  fee_percent numeric(6,3) NOT NULL DEFAULT 1.0,
  platform_pix_key text,
  platform_pix_name text,
  platform_pix_city text,
  split_provider text NOT NULL DEFAULT 'manual',
  ads_threshold integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_singleton CHECK (id),
  CONSTRAINT platform_settings_fee_range CHECK (fee_percent >= 0 AND fee_percent <= 20),
  CONSTRAINT platform_settings_threshold_range CHECK (ads_threshold >= 1 AND ads_threshold <= 1000)
);

GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone signed in can read platform settings" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins update platform settings" ON public.platform_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins insert platform settings" ON public.platform_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER platform_settings_updated_at BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- 3) Livro-caixa das taxas
CREATE TABLE IF NOT EXISTS public.platform_fee_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  bot_id uuid,
  gross_cents integer NOT NULL,
  fee_cents integer NOT NULL,
  net_cents integer NOT NULL,
  fee_percent numeric(6,3) NOT NULL,
  provider text NOT NULL DEFAULT 'manual_pix',
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_fee_ledger TO authenticated;
GRANT ALL ON public.platform_fee_ledger TO service_role;
ALTER TABLE public.platform_fee_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read own fee ledger" ON public.platform_fee_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS platform_fee_ledger_user_idx ON public.platform_fee_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_fee_ledger_order_idx ON public.platform_fee_ledger (order_id);

CREATE TRIGGER platform_fee_ledger_updated_at BEFORE UPDATE ON public.platform_fee_ledger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Pedidos: marcação de pagamento oficial
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS official_payment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_percent numeric(6,3);

-- 5) Perfil: contadores de evasão / anúncios
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unofficial_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ads_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_official_payment_at timestamptz;

-- 6) Atualiza contadores conforme pedidos entram
CREATE OR REPLACE FUNCTION public.track_official_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  threshold integer;
BEGIN
  IF NEW.channel = 'test' THEN
    RETURN NEW;
  END IF;

  SELECT ads_threshold INTO threshold FROM public.platform_settings WHERE id LIMIT 1;
  threshold := COALESCE(threshold, 10);

  IF NEW.official_payment THEN
    UPDATE public.profiles
       SET unofficial_streak = 0,
           ads_enabled = false,
           last_official_payment_at = now()
     WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles
       SET unofficial_streak = unofficial_streak + 1,
           ads_enabled = (unofficial_streak + 1) >= threshold
     WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_track_official_payment ON public.orders;
CREATE TRIGGER orders_track_official_payment
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.track_official_payment();

-- Recria triggers de pedidos que podem ter sido perdidos
DROP TRIGGER IF EXISTS orders_validate_status ON public.orders;
CREATE TRIGGER orders_validate_status BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_status();

DROP TRIGGER IF EXISTS orders_log_event ON public.orders;
CREATE TRIGGER orders_log_event AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_event();

DROP TRIGGER IF EXISTS orders_decrement_stock ON public.orders;
CREATE TRIGGER orders_decrement_stock AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_paid();