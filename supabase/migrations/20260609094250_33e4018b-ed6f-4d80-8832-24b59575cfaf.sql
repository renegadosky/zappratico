
-- 1) Expand profiles with store-profile fields, multi-select arrays, and terms
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS store_color TEXT,
  ADD COLUMN IF NOT EXISTS store_description TEXT,
  ADD COLUMN IF NOT EXISTS public_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS public_instagram TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- Backfill arrays from legacy single-value columns if present
UPDATE public.profiles
SET channels = jsonb_build_array(current_channel)
WHERE current_channel IS NOT NULL AND (channels IS NULL OR channels = '[]'::jsonb);

UPDATE public.profiles
SET goals = jsonb_build_array(main_goal)
WHERE main_goal IS NOT NULL AND (goals IS NULL OR goals = '[]'::jsonb);

-- 2) Multi-store table
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  segment TEXT,
  logo_url TEXT,
  color TEXT,
  description TEXT,
  public_whatsapp TEXT,
  public_instagram TEXT,
  address TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stores_user_idx ON public.stores(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own stores"
  ON public.stores FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER stores_updated
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Optional store linkage on bots (kept nullable for now)
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bots_store_idx ON public.bots(store_id);
