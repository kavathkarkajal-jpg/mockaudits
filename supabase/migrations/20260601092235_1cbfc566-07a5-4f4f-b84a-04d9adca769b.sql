
ALTER FUNCTION public.set_audit_week() SET search_path = public;
ALTER FUNCTION public.week_monday(timestamptz) SET search_path = public;

-- Revoke from anon/public so only authenticated/service_role can call helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.current_brand_id() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.current_store_id() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.current_region() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_store(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_brand(uuid) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_brand_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_store_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_region() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_store(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_brand(uuid) TO authenticated, service_role;
