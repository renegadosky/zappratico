
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS preparing_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE OR REPLACE FUNCTION public.validate_order_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('pending','paid','preparing','ready','shipped','completed','cancelled') THEN
    RAISE EXCEPTION 'Status inválido: %', NEW.status;
  END IF;

  -- Auto-stamp timestamps when status changes
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN
      NEW.paid_at = now();
    ELSIF NEW.status = 'preparing' AND NEW.preparing_at IS NULL THEN
      NEW.preparing_at = now();
    ELSIF NEW.status = 'ready' AND NEW.ready_at IS NULL THEN
      NEW.ready_at = now();
    ELSIF NEW.status IN ('shipped','completed') AND NEW.delivered_at IS NULL THEN
      NEW.delivered_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS orders_validate_status ON public.orders;
CREATE TRIGGER orders_validate_status
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_status();
