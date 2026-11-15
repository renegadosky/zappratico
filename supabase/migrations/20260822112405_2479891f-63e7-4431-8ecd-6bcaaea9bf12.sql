CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- platform_settings: only admins may read
DROP POLICY IF EXISTS "anyone signed in can read platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "admins update platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "admins insert platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_admin" ON public.platform_settings;

CREATE POLICY "platform_settings_admin_all" ON public.platform_settings
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- fee ledger policies use the internal helper
DROP POLICY IF EXISTS "owners read own fee ledger" ON public.platform_fee_ledger;
DROP POLICY IF EXISTS "fee_ledger_admin_read" ON public.platform_fee_ledger;

CREATE POLICY "fee_ledger_owner_or_admin_read" ON public.platform_fee_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);