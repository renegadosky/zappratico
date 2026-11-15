
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  business_name TEXT,
  segment TEXT,
  current_channel TEXT,
  main_goal TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bot templates (public read)
CREATE TABLE public.bot_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  segment TEXT NOT NULL,
  icon TEXT,
  flow JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Templates readable by authenticated" ON public.bot_templates
  FOR SELECT TO authenticated USING (true);

-- Bots
CREATE TABLE public.bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bot_type TEXT NOT NULL DEFAULT 'sales',
  segment TEXT,
  tone TEXT NOT NULL DEFAULT 'casual',
  greeting_morning TEXT,
  greeting_afternoon TEXT,
  greeting_evening TEXT,
  away_message TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  template_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own bots" ON public.bots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bots" ON public.bots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bots" ON public.bots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own bots" ON public.bots FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER bots_updated BEFORE UPDATE ON public.bots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX bots_user_idx ON public.bots(user_id);

-- Bot flows
CREATE TABLE public.bot_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own flows" ON public.bot_flows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own flows" ON public.bot_flows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own flows" ON public.bot_flows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own flows" ON public.bot_flows FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER flows_updated BEFORE UPDATE ON public.bot_flows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX flows_bot_idx ON public.bot_flows(bot_id);

-- Seed templates
INSERT INTO public.bot_templates (slug, name, description, segment, icon, flow) VALUES
('roupas', 'Bot para Roupas', 'Atendimento e vendas para loja de roupas', 'Loja de roupas', 'shirt',
  '[{"type":"message","text":"Olá! Bem-vindo(a) à nossa loja 👗"},{"type":"menu","options":["Ver coleção","Tamanhos","Falar com atendente"]},{"type":"catalog"},{"type":"payment"}]'::jsonb),
('delivery', 'Bot para Delivery', 'Pedidos rápidos para restaurante/delivery', 'Delivery', 'utensils',
  '[{"type":"message","text":"Bem-vindo! Pronto para pedir? 🍔"},{"type":"menu","options":["Cardápio","Promoções","Acompanhar pedido"]},{"type":"catalog"},{"type":"address"},{"type":"payment"}]'::jsonb),
('cosmeticos', 'Bot para Cosméticos', 'Vendas de produtos de beleza', 'Cosméticos', 'sparkles',
  '[{"type":"message","text":"Oi linda! ✨ Como posso te ajudar?"},{"type":"menu","options":["Lançamentos","Mais vendidos","Promoções"]},{"type":"catalog"},{"type":"upsell"},{"type":"payment"}]'::jsonb),
('eletronicos', 'Bot para Eletrônicos', 'Atendimento técnico e vendas', 'Eletrônicos', 'cpu',
  '[{"type":"message","text":"Olá! Tecnologia que transforma 🚀"},{"type":"menu","options":["Smartphones","Notebooks","Acessórios","Suporte"]},{"type":"catalog"},{"type":"payment"}]'::jsonb),
('afiliados', 'Bot para Afiliados', 'Recomendação e vendas via afiliados', 'Afiliados', 'link',
  '[{"type":"message","text":"Oi! Tenho ofertas selecionadas pra você 🔥"},{"type":"menu","options":["Ofertas do dia","Categorias","Mais vendidos"]},{"type":"catalog"}]'::jsonb),
('generica', 'Bot Loja Genérica', 'Modelo flexível para qualquer negócio', 'Loja genérica', 'store',
  '[{"type":"message","text":"Olá! Como posso te ajudar hoje?"},{"type":"menu","options":["Produtos","Promoções","Falar conosco"]},{"type":"catalog"},{"type":"payment"}]'::jsonb);
