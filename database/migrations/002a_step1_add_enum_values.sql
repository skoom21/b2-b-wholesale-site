-- STEP 1 of 2 — run this file FIRST, on its own, and let it finish.
--
-- Postgres will not let you add a value to an existing enum type and use
-- that same value in the same transaction. Supabase's SQL editor runs
-- everything you paste as one transaction, so adding 'staff'/'owner' to
-- user_role has to happen here, separately, before anything in step 2
-- can reference them.
--
-- After this succeeds, clear the editor and run
-- 002_multi_tenant_foundation.sql (step 2) as a second, separate run.

DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
