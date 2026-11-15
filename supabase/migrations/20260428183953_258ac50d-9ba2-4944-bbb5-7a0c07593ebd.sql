
-- Credenciais WhatsApp Cloud API por bot
CREATE TABLE public.whatsapp_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL UNIQUE REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  phone_number_id text,
  business_account_id text,
  access_token text,
  verify_token text,
  display_phone_number text,
  is_connected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wa credentials" ON public.whatsapp_credentials
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own wa credentials" ON public.whatsapp_credentials
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own wa credentials" ON public.whatsapp_credentials
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own wa credentials" ON public.whatsapp_credentials
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_wa_credentials_updated BEFORE UPDATE ON public.whatsapp_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lookup rápido pelo phone_number_id (usado no webhook)
CREATE INDEX idx_wa_credentials_phone_number_id ON public.whatsapp_credentials(phone_number_id);

-- Conversas
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  customer_phone text NOT NULL,
  customer_name text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bot_id, customer_phone)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own conversations" ON public.conversations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own conversations" ON public.conversations
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_conversations_updated BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_conversations_bot ON public.conversations(bot_id, last_message_at DESC);

-- Mensagens
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  content text NOT NULL,
  wa_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own messages" ON public.messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);
