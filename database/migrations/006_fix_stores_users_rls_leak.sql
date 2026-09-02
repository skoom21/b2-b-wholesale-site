-- =====================================================================
-- Fixes a confirmed cross-tenant RLS leak on `stores` and `users`: any
-- brand's admin can currently read AND write any OTHER brand's stores
-- and users directly via the API (bypassing the app entirely), even
-- though the policies in 002_multi_tenant_foundation.sql read as
-- correctly brand-scoped. `products` (same policy shape) is NOT
-- affected, which means some other, unaccounted-for permissive policy
-- is still active on these two tables specifically — most likely a
-- pre-multi-tenant policy that a DROP POLICY IF EXISTS never matched
-- because its live name doesn't match what's in the migration files.
--
-- Rather than guess at the exact stale name, this drops EVERY policy
-- currently on `stores` and `users` (whatever it's actually called)
-- and recreates only the correct, brand-scoped set. This is safe:
-- these two tables' full intended policy set is fully known and
-- reproduced below in full, so nothing is lost by clearing first.
--
-- Idempotent — safe to run more than once.
-- =====================================================================

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'stores' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.stores', pol.policyname);
    END LOOP;

    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
    END LOOP;
END $$;

-- Re-enable defensively in case it was ever disabled.
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- users — full intended policy set, from 002_multi_tenant_foundation.sql
-- ---------------------------------------------------------------------
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins/staff can view their brand's users" ON users
    FOR SELECT USING (
        current_user_role() = 'owner'
        OR (current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = users.brand_id)
    );

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role = current_user_role()
        AND brand_id IS NOT DISTINCT FROM current_user_brand_id()
    );

-- RLS controls which rows can be updated, but cannot stop a user from
-- changing privileged columns on their own row. Protect those columns at
-- the database layer so a retailer/staff member cannot promote themselves,
-- switch tenant, reactivate themselves, or change the account identity by
-- calling Supabase directly. Owner-operated account management remains
-- unaffected.
CREATE OR REPLACE FUNCTION protect_user_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() = OLD.id AND current_user_role() <> 'owner' THEN
        IF NEW.role IS DISTINCT FROM OLD.role
           OR NEW.brand_id IS DISTINCT FROM OLD.brand_id
           OR NEW.is_active IS DISTINCT FROM OLD.is_active
           OR NEW.email IS DISTINCT FROM OLD.email THEN
            RAISE EXCEPTION 'You cannot change protected account fields';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_security_fields_trigger ON users;
CREATE TRIGGER protect_user_security_fields_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION protect_user_security_fields();

CREATE POLICY "Owner can manage all users" ON users
    FOR ALL USING (current_user_role() = 'owner');

-- ---------------------------------------------------------------------
-- stores — full intended policy set, from 002_multi_tenant_foundation.sql
-- ---------------------------------------------------------------------
CREATE POLICY "Retailers can view their own store" ON stores
    FOR SELECT USING (
        user_id = auth.uid()
        OR current_user_role() = 'owner'
        OR (current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = stores.brand_id)
    );

CREATE POLICY "Admins/staff can manage their brand's stores" ON stores
    FOR ALL USING (
        current_user_role() = 'owner'
        OR (current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = stores.brand_id)
    );

CREATE POLICY "Retailers can update their own store" ON stores
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
