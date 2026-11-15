-- ============ product_images ============
CREATE TABLE public.product_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_images_product_idx ON public.product_images(product_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT SELECT ON public.product_images TO anon;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_images_owner_all" ON public.product_images
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "product_images_public_read" ON public.product_images
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.whatsapp_settings ws ON ws.bot_id = p.bot_id
      WHERE p.id = product_images.product_id AND ws.store_enabled = true
    )
  );

-- ============ product_option_groups ============
CREATE TABLE public.product_option_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  min_select integer NOT NULL DEFAULT 0,
  max_select integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_option_groups_product_idx ON public.product_option_groups(product_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_option_groups TO authenticated;
GRANT SELECT ON public.product_option_groups TO anon;
GRANT ALL ON public.product_option_groups TO service_role;
ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_option_groups_owner_all" ON public.product_option_groups
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "product_option_groups_public_read" ON public.product_option_groups
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.whatsapp_settings ws ON ws.bot_id = p.bot_id
      WHERE p.id = product_option_groups.product_id AND ws.store_enabled = true
    )
  );
CREATE TRIGGER product_option_groups_updated BEFORE UPDATE ON public.product_option_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ product_options ============
CREATE TABLE public.product_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_options_group_idx ON public.product_options(group_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_options TO authenticated;
GRANT SELECT ON public.product_options TO anon;
GRANT ALL ON public.product_options TO service_role;
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_options_owner_all" ON public.product_options
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "product_options_public_read" ON public.product_options
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.product_option_groups g
      JOIN public.products p ON p.id = g.product_id
      JOIN public.whatsapp_settings ws ON ws.bot_id = p.bot_id
      WHERE g.id = product_options.group_id AND ws.store_enabled = true
    )
  );

-- ============ store_categories ============
CREATE TABLE public.store_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_categories_bot_idx ON public.store_categories(bot_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_categories TO authenticated;
GRANT SELECT ON public.store_categories TO anon;
GRANT ALL ON public.store_categories TO service_role;
ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_categories_owner_all" ON public.store_categories
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "store_categories_public_read" ON public.store_categories
  FOR SELECT TO anon USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.whatsapp_settings ws
      WHERE ws.bot_id = store_categories.bot_id AND ws.store_enabled = true
    )
  );
CREATE TRIGGER store_categories_updated BEFORE UPDATE ON public.store_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ store_products ============
CREATE TABLE public.store_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.store_categories(id) ON DELETE SET NULL,
  price_override_cents integer,
  is_featured boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, product_id)
);
CREATE INDEX store_products_bot_idx ON public.store_products(bot_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_products TO authenticated;
GRANT SELECT ON public.store_products TO anon;
GRANT ALL ON public.store_products TO service_role;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_products_owner_all" ON public.store_products
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "store_products_public_read" ON public.store_products
  FOR SELECT TO anon USING (
    is_available = true AND EXISTS (
      SELECT 1 FROM public.whatsapp_settings ws
      WHERE ws.bot_id = store_products.bot_id AND ws.store_enabled = true
    )
  );
CREATE TRIGGER store_products_updated BEFORE UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ quick_messages ============
CREATE TABLE public.quick_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  bot_id uuid REFERENCES public.bots(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quick_messages_user_idx ON public.quick_messages(user_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_messages TO authenticated;
GRANT ALL ON public.quick_messages TO service_role;
ALTER TABLE public.quick_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quick_messages_owner_all" ON public.quick_messages
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER quick_messages_updated BEFORE UPDATE ON public.quick_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();