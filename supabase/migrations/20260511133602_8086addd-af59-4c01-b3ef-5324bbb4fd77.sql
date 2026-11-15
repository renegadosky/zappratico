-- Cardápios (menus) + itens + modelos prontos

CREATE TABLE public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  template_slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_menus_bot ON public.menus(bot_id);
CREATE INDEX idx_menus_user ON public.menus(user_id);

ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own menus" ON public.menus FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own menus" ON public.menus FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own menus" ON public.menus FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own menus" ON public.menus FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public can view menus of enabled stores" ON public.menus
FOR SELECT TO anon
USING (
  is_active = true AND EXISTS (
    SELECT 1 FROM public.whatsapp_settings ws
    WHERE ws.bot_id = menus.bot_id AND ws.store_enabled = true
  )
);

CREATE TRIGGER trg_menus_updated_at
BEFORE UPDATE ON public.menus
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- menu_items
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  price_override_cents integer,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_id, product_id)
);

CREATE INDEX idx_menu_items_menu ON public.menu_items(menu_id);
CREATE INDEX idx_menu_items_product ON public.menu_items(product_id);
CREATE INDEX idx_menu_items_user ON public.menu_items(user_id);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own menu items" ON public.menu_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own menu items" ON public.menu_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own menu items" ON public.menu_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own menu items" ON public.menu_items FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public can view items of enabled stores" ON public.menu_items
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.menus m
    JOIN public.whatsapp_settings ws ON ws.bot_id = m.bot_id
    WHERE m.id = menu_items.menu_id
      AND m.is_active = true
      AND ws.store_enabled = true
  )
);

-- menu_templates
CREATE TABLE public.menu_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  segment text,
  icon text,
  suggested_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menu templates readable by authenticated" ON public.menu_templates
FOR SELECT TO authenticated USING (true);

-- Seed de modelos
INSERT INTO public.menu_templates (slug, name, description, segment, icon, suggested_items) VALUES
('almoco', 'Almoço', 'Pratos executivos e marmitas do dia', 'restaurante', '🍱',
 '["Prato do dia","Marmita P","Marmita M","Marmita G","Bebida"]'::jsonb),
('jantar', 'Jantar', 'Cardápio noturno completo', 'restaurante', '🍽️',
 '["Entrada","Prato principal","Sobremesa","Bebida"]'::jsonb),
('combos', 'Combos & Promos', 'Combinações com preço promocional', 'lanchonete', '🔥',
 '["Combo individual","Combo casal","Combo família","Promo do dia"]'::jsonb),
('bebidas', 'Bebidas', 'Refrigerantes, sucos e drinks', 'geral', '🥤',
 '["Refrigerante lata","Refrigerante 2L","Suco natural","Água"]'::jsonb),
('sobremesas', 'Sobremesas', 'Doces e finalizações', 'doceria', '🍰',
 '["Bolo fatia","Torta","Brigadeiro","Pudim"]'::jsonb),
('pizzas', 'Pizzas', 'Cardápio de pizzas', 'pizzaria', '🍕',
 '["Pizza Calabresa","Pizza Marguerita","Pizza Portuguesa","Pizza Doce"]'::jsonb);