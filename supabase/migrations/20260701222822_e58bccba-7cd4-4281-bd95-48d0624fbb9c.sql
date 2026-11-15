
-- Estoque em produtos
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS category text;

-- Imagem do cardápio pronto
ALTER TABLE public.menus
  ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Decrementa estoque quando pedido vira "paid"
CREATE OR REPLACE FUNCTION public.decrement_stock_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    IF NEW.items IS NOT NULL THEN
      FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
      LOOP
        IF item ? 'product_id' AND (item->>'quantity')::int > 0 THEN
          UPDATE public.products
             SET stock_quantity = GREATEST(0, stock_quantity - (item->>'quantity')::int)
           WHERE id = (item->>'product_id')::uuid
             AND track_stock = true;
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_decrement_stock ON public.orders;
CREATE TRIGGER orders_decrement_stock
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_paid();
