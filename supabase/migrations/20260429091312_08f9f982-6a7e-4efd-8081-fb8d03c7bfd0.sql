
-- Storage bucket para imagens de produtos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'];

-- Políticas: leitura pública, escrita só do dono (caminho deve começar com user_id)
CREATE POLICY "Product images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Users upload own product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Rate limit table simples (por phone+bot)
CREATE TABLE IF NOT EXISTS public.wa_rate_limits (
  bot_id uuid NOT NULL,
  customer_phone text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bot_id, customer_phone)
);
ALTER TABLE public.wa_rate_limits ENABLE ROW LEVEL SECURITY;
-- Sem políticas: só o admin (service role) acessa.

-- Constraint única necessária para o upsert de conversations já existir
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_bot_phone_unique'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_bot_phone_unique UNIQUE (bot_id, customer_phone);
  END IF;
END $$;
