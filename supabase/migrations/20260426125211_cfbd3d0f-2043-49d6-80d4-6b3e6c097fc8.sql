-- PRODUCTS
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own products" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own products" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own products" ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own products" ON public.products FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_products_bot_id ON public.products(bot_id);
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PAYMENT SETTINGS
CREATE TABLE public.payment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL UNIQUE REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'pix_manual', -- pix_manual | mercadopago | asaas
  pix_key TEXT,
  pix_key_type TEXT, -- cpf | cnpj | email | phone | random
  beneficiary_name TEXT,
  beneficiary_city TEXT,
  mp_access_token TEXT,
  asaas_api_key TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payment settings" ON public.payment_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own payment settings" ON public.payment_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own payment settings" ON public.payment_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own payment settings" ON public.payment_settings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER payment_settings_updated_at BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WHATSAPP SETTINGS
CREATE TABLE public.whatsapp_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL UNIQUE REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  phone_number TEXT, -- E.164, ex: +5511999999999
  store_slug TEXT UNIQUE,
  store_enabled BOOLEAN NOT NULL DEFAULT false,
  store_title TEXT,
  store_description TEXT,
  buy_message_template TEXT DEFAULT 'Olá! Quero comprar: {produto} - {preco}',
  use_native_catalog BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own whatsapp settings" ON public.whatsapp_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own whatsapp settings" ON public.whatsapp_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own whatsapp settings" ON public.whatsapp_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own whatsapp settings" ON public.whatsapp_settings FOR DELETE USING (auth.uid() = user_id);

-- Public read access for enabled stores
CREATE POLICY "Public can view enabled stores" ON public.whatsapp_settings 
  FOR SELECT TO anon, authenticated USING (store_enabled = true);

CREATE POLICY "Public can view bots with enabled store" ON public.bots
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.whatsapp_settings ws WHERE ws.bot_id = bots.id AND ws.store_enabled = true)
  );

CREATE POLICY "Public can view products of enabled stores" ON public.products
  FOR SELECT TO anon USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.whatsapp_settings ws WHERE ws.bot_id = products.bot_id AND ws.store_enabled = true
    )
  );

CREATE INDEX idx_whatsapp_store_slug ON public.whatsapp_settings(store_slug);
CREATE TRIGGER whatsapp_settings_updated_at BEFORE UPDATE ON public.whatsapp_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();