-- Tabela de eventos do pedido (timeline)
CREATE TABLE public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  bot_id uuid NOT NULL,
  type text NOT NULL,
  from_status text,
  to_status text,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_events_order_id ON public.order_events(order_id, created_at DESC);
CREATE INDEX idx_order_events_user_id ON public.order_events(user_id, created_at DESC);

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own order events"
  ON public.order_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own order events"
  ON public.order_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own order events"
  ON public.order_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own order events"
  ON public.order_events FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: registrar criação e mudanças de status automaticamente
CREATE OR REPLACE FUNCTION public.log_order_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_events (order_id, user_id, bot_id, type, to_status, message)
    VALUES (NEW.id, NEW.user_id, NEW.bot_id, 'created', NEW.status, 'Pedido criado');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_events (order_id, user_id, bot_id, type, from_status, to_status, message)
    VALUES (NEW.id, NEW.user_id, NEW.bot_id, 'status_changed', OLD.status, NEW.status,
            'Status alterado para ' || NEW.status);
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_event ON public.orders;
CREATE TRIGGER trg_log_order_event
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_event();

-- Backfill: cria evento "created" para pedidos já existentes que não têm timeline
INSERT INTO public.order_events (order_id, user_id, bot_id, type, to_status, message, created_at)
SELECT o.id, o.user_id, o.bot_id, 'created', o.status, 'Pedido criado', o.created_at
FROM public.orders o
WHERE NOT EXISTS (SELECT 1 FROM public.order_events e WHERE e.order_id = o.id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_events;