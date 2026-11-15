-- Cardápio visual: tema, template, imagem de hero, subtítulo
ALTER TABLE public.menus
  ADD COLUMN IF NOT EXISTS template_slug TEXT DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS theme JSONB DEFAULT '{"primary":"#16a34a","background":"#ffffff","text":"#0f172a","accent":"#f59e0b"}'::jsonb,
  ADD COLUMN IF NOT EXISTS header_image_url TEXT,
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- PIX automático: dados do QR code do pedido
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code_text TEXT,
  ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_charge_id TEXT,
  ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount_cents INTEGER;

-- Mensagens extras do bot
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS welcome_first_contact TEXT DEFAULT 'Olá! 👋 Seja bem-vindo(a). Como posso te ajudar hoje?',
  ADD COLUMN IF NOT EXISTS fallback_message TEXT DEFAULT 'Desculpe, não entendi. Pode reformular ou digitar *menu* para ver as opções? 🙂',
  ADD COLUMN IF NOT EXISTS order_confirmation TEXT DEFAULT 'Pedido recebido! ✅ Em instantes te envio os detalhes do pagamento.',
  ADD COLUMN IF NOT EXISTS post_sale_thanks TEXT DEFAULT 'Obrigado pela compra! 💚 Qualquer dúvida estamos por aqui.';

-- Provider PIX por bot (token criptografado pelo gateway, guardamos referência)
ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS preferred_mode TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS mp_access_token TEXT,
  ADD COLUMN IF NOT EXISTS asaas_api_key TEXT;