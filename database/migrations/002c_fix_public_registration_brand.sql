-- =====================================================================
-- Fix: public /register was never updated to set the new NOT NULL
-- stores.brand_id column, so every new retailer signup on Teetoz's
-- live storefront has been failing with a 23502 not-null violation
-- since 002_multi_tenant_foundation.sql went in. Per the approved plan,
-- public self-registration stays hardcoded to the Teetoz brand for
-- this phase (no brand-picker UI), so this restores that behavior:
-- new self-registered users (and their store) default to Teetoz.
--
-- Idempotent — safe to run more than once.
-- =====================================================================

-- Looked up by slug rather than hardcoding a UUID in code, so this
-- keeps working if the Teetoz brand row is ever recreated (e.g. in a
-- fresh environment). SECURITY DEFINER so it works for the `anon`/
-- `authenticated` roles even though `brands` itself is owner-only RLS.
CREATE OR REPLACE FUNCTION public.teetoz_brand_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT id FROM public.brands WHERE slug = 'teetoz' LIMIT 1; $$;

-- Same as before, except a self-registered user with no explicit
-- brand_id/role in their signup metadata (i.e. the public /register
-- flow) now defaults to the Teetoz brand instead of NULL.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, phone, brand_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'retailer'::user_role),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'brand_id', '')::UUID,
      CASE
        WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'retailer') = 'retailer'
        THEN public.teetoz_brand_id()
        ELSE NULL
      END
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = NOW();

  RETURN NEW;
END;
$$;
