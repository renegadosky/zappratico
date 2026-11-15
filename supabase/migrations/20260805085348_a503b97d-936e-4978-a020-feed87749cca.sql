ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS platform_asaas_wallet_id text,
  ADD COLUMN IF NOT EXISTS platform_mp_user_id text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS split_status text,
  ADD COLUMN IF NOT EXISTS provider_payment_status text;