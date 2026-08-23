-- =====================================================================
-- Multi-tenant SaaS foundation
-- =====================================================================
-- Converts this from a single-tenant app (one distributor "Teetoz") into
-- a multi-tenant platform: an "owner" role operates the platform and
-- onboards "brands" (tenants), each with isolated inventory/orders/
-- retailer customers and their own staff (with tracked-record-only
-- payroll — no real payment processor wired up in this phase).
--
-- Every statement is written to be safe to run more than once in full
-- (ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS + CREATE POLICY,
-- ON CONFLICT DO NOTHING, guarded DO blocks for enum values). This is
-- the same idempotency convention as add_credit_history_write_policies.sql
-- — a non-idempotent version of that file broke production once when
-- re-run partway. Run this whole file top to bottom in the Supabase SQL
-- editor; re-running it again later is safe.
--
-- THIS IS STEP 2 OF 2. Run 002a_step1_add_enum_values.sql FIRST, by
-- itself, and let it finish before running this file — Postgres won't
-- let a new enum value ('staff'/'owner') be added and used in the same
-- transaction, and this file uses both.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Brand-new enums (user_role's new 'staff'/'owner' values were
--    already added by step 1)
-- ---------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE brand_status AS ENUM ('active', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE billing_interval AS ENUM ('monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE employment_status AS ENUM ('active', 'on_leave', 'terminated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE pay_type AS ENUM ('hourly', 'salary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE pay_period_status AS ENUM ('open', 'processed', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---------------------------------------------------------------------
-- 2. New tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status brand_status NOT NULL DEFAULT 'active',
    contact_email TEXT,
    contact_phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    billing_interval billing_interval NOT NULL DEFAULT 'monthly',
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status subscription_status NOT NULL DEFAULT 'trialing',
    current_period_start DATE NOT NULL DEFAULT CURRENT_DATE,
    current_period_end DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    cancel_at_period_end BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_brand_subscriptions_brand_id ON brand_subscriptions(brand_id);

CREATE TABLE IF NOT EXISTS staff_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    job_title TEXT,
    pay_type pay_type NOT NULL DEFAULT 'salary',
    pay_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
    employment_status employment_status NOT NULL DEFAULT 'active',
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    termination_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_details_brand_id ON staff_details(brand_id);

CREATE TABLE IF NOT EXISTS payroll_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff_details(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    gross_amount DECIMAL(10, 2) NOT NULL,
    deductions DECIMAL(10, 2) NOT NULL DEFAULT 0,
    net_amount DECIMAL(10, 2) NOT NULL,
    status pay_period_status NOT NULL DEFAULT 'open',
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT net_amount_check CHECK (net_amount = gross_amount - deductions)
);
CREATE INDEX IF NOT EXISTS idx_payroll_records_staff_id ON payroll_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_brand_id ON payroll_records(brand_id);


-- ---------------------------------------------------------------------
-- 3. Extend the auth-sync trigger to also set brand_id from signup metadata
-- ---------------------------------------------------------------------
-- handle_new_user() (from fix_user_sync_and_backfill.sql) is SECURITY
-- DEFINER, so it's the one place that can populate public.users.brand_id
-- at account-creation time without needing a service-role key: pass
-- options.data.brand_id on supabase.auth.signUp() and this trigger picks
-- it up. NULL brand_id (e.g. the owner account) is handled by NULLIF.
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
    NULLIF(NEW.raw_user_meta_data->>'brand_id', '')::UUID
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = NOW();

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------
-- 4. brand_id columns (nullable for now — backfilled below, then a
--    subset gets NOT NULL enforced once every existing row has one)
-- ---------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_brand_id ON users(brand_id);
CREATE INDEX IF NOT EXISTS idx_stores_brand_id ON stores(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_categories_brand_id ON categories(brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_brand_id ON orders(brand_id);


-- ---------------------------------------------------------------------
-- 5. Seed the Teetoz brand and backfill every existing row into it
-- ---------------------------------------------------------------------
INSERT INTO brands (slug, name, status)
VALUES ('teetoz', 'Teetoz', 'active')
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
    teetoz_id UUID;
BEGIN
    SELECT id INTO teetoz_id FROM brands WHERE slug = 'teetoz';

    UPDATE users SET brand_id = teetoz_id WHERE brand_id IS NULL AND role != 'owner';
    UPDATE stores SET brand_id = teetoz_id WHERE brand_id IS NULL;
    UPDATE products SET brand_id = teetoz_id WHERE brand_id IS NULL;
    UPDATE categories SET brand_id = teetoz_id WHERE brand_id IS NULL;
    UPDATE orders SET brand_id = teetoz_id WHERE brand_id IS NULL;
END $$;

-- Migrate the never-fully-wired 'manager' role to 'staff'
UPDATE users SET role = 'staff' WHERE role = 'manager';


-- ---------------------------------------------------------------------
-- 6. Enforce NOT NULL now that every row is backfilled
--    (users.brand_id stays nullable — NULL means 'owner')
-- ---------------------------------------------------------------------
ALTER TABLE stores ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE products ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE categories ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN brand_id SET NOT NULL;


-- ---------------------------------------------------------------------
-- 7. Enable RLS on the new tables
-- ---------------------------------------------------------------------
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------
-- 8. SECURITY DEFINER helpers to read the caller's own row.
-- ---------------------------------------------------------------------
-- Every policy below needs to know the calling user's role/brand_id, and
-- naively doing that with `EXISTS (SELECT 1 FROM users WHERE id =
-- auth.uid() ...)` inside a policy ON users causes Postgres to
-- re-evaluate that same policy for the subquery's own row scan, forever
-- ("42P17: infinite recursion detected in policy for relation users").
-- Since virtually every other table's policy also looks up the caller
-- via `users`, that recursion isn't contained to the users table — it
-- breaks every read across the schema the moment any policy touches
-- `users`. SECURITY DEFINER functions sidestep this: they run as the
-- function owner (the migration-running role, which owns these tables
-- and isn't RLS-restricted on them since FORCE ROW LEVEL SECURITY is
-- never set), so the lookup inside never re-triggers RLS.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT role FROM public.users WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.current_user_brand_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT brand_id FROM public.users WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT is_active FROM public.users WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.user_brand_id(target_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT brand_id FROM public.users WHERE id = target_id; $$;


-- ---------------------------------------------------------------------
-- 9. Rewrite every existing RLS policy to be brand-aware.
--    Pattern: the old `role IN ('admin', 'manager')` bypass becomes
--    `role IN ('admin', 'staff') AND same brand` for admin/staff, plus
--    a separate, unconditional bypass for `role = 'owner'`. Every check
--    against the caller's own role/brand goes through the helpers above
--    instead of a subquery on users, to avoid the recursion above.
-- ---------------------------------------------------------------------

-- users
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins/staff can view their brand's users" ON users;
CREATE POLICY "Admins/staff can view their brand's users" ON users
    FOR SELECT USING (
        current_user_role() = 'owner'
        OR (current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = users.brand_id)
    );

DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Owner can manage all users" ON users;
CREATE POLICY "Owner can manage all users" ON users
    FOR ALL USING (current_user_role() = 'owner');

-- stores
DROP POLICY IF EXISTS "Retailers can view their own store" ON stores;
CREATE POLICY "Retailers can view their own store" ON stores
    FOR SELECT USING (
        user_id = auth.uid()
        OR current_user_role() = 'owner'
        OR (current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = stores.brand_id)
    );

DROP POLICY IF EXISTS "Admins can manage stores" ON stores;
DROP POLICY IF EXISTS "Admins/staff can manage their brand's stores" ON stores;
CREATE POLICY "Admins/staff can manage their brand's stores" ON stores
    FOR ALL USING (
        current_user_role() = 'owner'
        OR (current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = stores.brand_id)
    );

DROP POLICY IF EXISTS "Retailers can update their own store" ON stores;
CREATE POLICY "Retailers can update their own store" ON stores
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- products
-- NOTE: the old "Anyone can view active products" policy had no brand
-- condition at all — every active product from every brand would have
-- been publicly visible. There's no public storefront in this app today
-- (catalog browsing always requires login), so "anyone" here becomes
-- "any authenticated member of that product's own brand" instead.
DROP POLICY IF EXISTS "Anyone can view active products" ON products;
DROP POLICY IF EXISTS "Brand members can view their brand's products" ON products;
CREATE POLICY "Brand members can view their brand's products" ON products
    FOR SELECT USING (
        current_user_role() = 'owner'
        OR (
            current_user_brand_id() = products.brand_id
            AND (current_user_role() IN ('admin', 'staff') OR current_user_is_active() = true)
        )
    );

DROP POLICY IF EXISTS "Admins can manage products" ON products;
DROP POLICY IF EXISTS "Admins/staff can manage their brand's products" ON products;
CREATE POLICY "Admins/staff can manage their brand's products" ON products
    FOR ALL USING (
        current_user_role() = 'owner'
        OR (current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = products.brand_id)
    );

-- categories
-- Same fix as products: no public storefront exists, so "anyone" means
-- "any authenticated member of that category's own brand".
DROP POLICY IF EXISTS "Anyone can view active categories" ON categories;
DROP POLICY IF EXISTS "Brand members can view their brand's categories" ON categories;
CREATE POLICY "Brand members can view their brand's categories" ON categories
    FOR SELECT USING (
        current_user_role() = 'owner'
        OR (
            current_user_brand_id() = categories.brand_id
            AND (current_user_role() IN ('admin', 'staff') OR current_user_is_active() = true)
        )
    );

DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
DROP POLICY IF EXISTS "Admins/staff can manage their brand's categories" ON categories;
CREATE POLICY "Admins/staff can manage their brand's categories" ON categories
    FOR ALL USING (
        current_user_role() = 'owner'
        OR (current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = categories.brand_id)
    );

-- orders
DROP POLICY IF EXISTS "Users can view their store's orders" ON orders;
CREATE POLICY "Users can view their store's orders" ON orders
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = orders.store_id AND stores.user_id = auth.uid())
        OR current_user_role() = 'owner'
        OR (current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = orders.brand_id)
    );

DROP POLICY IF EXISTS "Retailers can create orders for their store" ON orders;
CREATE POLICY "Retailers can create orders for their store" ON orders
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = store_id AND stores.user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
DROP POLICY IF EXISTS "Admins/staff can manage their brand's orders" ON orders;
CREATE POLICY "Admins/staff can manage their brand's orders" ON orders
    FOR ALL USING (
        current_user_role() = 'owner'
        OR (current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = orders.brand_id)
    );

-- order_items (transitive via orders -> stores / orders.brand_id)
DROP POLICY IF EXISTS "Users can view items for their orders" ON order_items;
CREATE POLICY "Users can view items for their orders" ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND (
                EXISTS (SELECT 1 FROM stores WHERE stores.id = orders.store_id AND stores.user_id = auth.uid())
                OR current_user_role() = 'owner'
                OR (current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = orders.brand_id)
            )
        )
    );

DROP POLICY IF EXISTS "Users can create order items for their orders" ON order_items;
CREATE POLICY "Users can create order items for their orders" ON order_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders JOIN stores ON stores.id = orders.store_id
            WHERE orders.id = order_id AND stores.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins/staff can manage their brand's order items" ON order_items;
CREATE POLICY "Admins/staff can manage their brand's order items" ON order_items
    FOR ALL USING (
        current_user_role() = 'owner'
        OR EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = orders.brand_id
        )
    );

-- invoices (transitive via stores.brand_id)
DROP POLICY IF EXISTS "Users can view their store's invoices" ON invoices;
CREATE POLICY "Users can view their store's invoices" ON invoices
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = invoices.store_id AND stores.user_id = auth.uid())
        OR current_user_role() = 'owner'
        OR EXISTS (
            SELECT 1 FROM stores WHERE stores.id = invoices.store_id
            AND current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = stores.brand_id
        )
    );

DROP POLICY IF EXISTS "Admins can manage invoices" ON invoices;
DROP POLICY IF EXISTS "Admins/staff can manage their brand's invoices" ON invoices;
CREATE POLICY "Admins/staff can manage their brand's invoices" ON invoices
    FOR ALL USING (
        current_user_role() = 'owner'
        OR EXISTS (
            SELECT 1 FROM stores WHERE stores.id = invoices.store_id
            AND current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = stores.brand_id
        )
    );

DROP POLICY IF EXISTS "Retailers can create an invoice for their own order" ON invoices;
CREATE POLICY "Retailers can create an invoice for their own order" ON invoices
    FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = invoices.store_id AND stores.user_id = auth.uid())
    );

-- inventory_transactions (transitive via products.brand_id)
DROP POLICY IF EXISTS "Admins can view inventory transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Admins/staff can view their brand's inventory transactions" ON inventory_transactions;
CREATE POLICY "Admins/staff can view their brand's inventory transactions" ON inventory_transactions
    FOR SELECT USING (
        current_user_role() = 'owner'
        OR EXISTS (
            SELECT 1 FROM products WHERE products.id = inventory_transactions.product_id
            AND current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = products.brand_id
        )
    );

DROP POLICY IF EXISTS "Admins can log inventory transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Admins/staff can log their brand's inventory transactions" ON inventory_transactions;
CREATE POLICY "Admins/staff can log their brand's inventory transactions" ON inventory_transactions
    FOR INSERT
    WITH CHECK (
        current_user_role() = 'owner'
        OR EXISTS (
            SELECT 1 FROM products WHERE products.id = inventory_transactions.product_id
            AND current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = products.brand_id
        )
    );

-- activity_logs (transitive via the acting user's own brand_id)
DROP POLICY IF EXISTS "Admins can view activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Admins/staff can view their brand's activity logs" ON activity_logs;
CREATE POLICY "Admins/staff can view their brand's activity logs" ON activity_logs
    FOR SELECT USING (
        current_user_role() = 'owner'
        OR (
            current_user_role() IN ('admin', 'staff')
            AND current_user_brand_id() = public.user_brand_id(activity_logs.user_id)
        )
    );

DROP POLICY IF EXISTS "Authenticated users can log activity" ON activity_logs;
CREATE POLICY "Authenticated users can log activity" ON activity_logs
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- store_credit_history (transitive via stores.brand_id)
DROP POLICY IF EXISTS "Users can view their store's credit history" ON store_credit_history;
CREATE POLICY "Users can view their store's credit history" ON store_credit_history
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = store_credit_history.store_id AND stores.user_id = auth.uid())
        OR current_user_role() = 'owner'
        OR EXISTS (
            SELECT 1 FROM stores WHERE stores.id = store_credit_history.store_id
            AND current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = stores.brand_id
        )
    );

DROP POLICY IF EXISTS "Retailers can request credit for their own store" ON store_credit_history;
CREATE POLICY "Retailers can request credit for their own store" ON store_credit_history
    FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = store_credit_history.store_id AND stores.user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Admins can manage credit history" ON store_credit_history;
DROP POLICY IF EXISTS "Admins/staff can manage their brand's credit history" ON store_credit_history;
CREATE POLICY "Admins/staff can manage their brand's credit history" ON store_credit_history
    FOR ALL
    USING (
        current_user_role() = 'owner'
        OR EXISTS (
            SELECT 1 FROM stores WHERE stores.id = store_credit_history.store_id
            AND current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = stores.brand_id
        )
    )
    WITH CHECK (
        current_user_role() = 'owner'
        OR EXISTS (
            SELECT 1 FROM stores WHERE stores.id = store_credit_history.store_id
            AND current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = stores.brand_id
        )
    );


-- ---------------------------------------------------------------------
-- 10. RLS for the 4 new tables
-- ---------------------------------------------------------------------

-- brands / brand_subscriptions: owner-only in this phase. No brand-admin
-- billing UI exists yet, so it's simpler to lock this down now and open
-- a brand-scoped read-only view later than to get that policy right
-- on the first pass.
DROP POLICY IF EXISTS "Owner can manage brands" ON brands;
CREATE POLICY "Owner can manage brands" ON brands
    FOR ALL USING (current_user_role() = 'owner');

DROP POLICY IF EXISTS "Owner can manage brand subscriptions" ON brand_subscriptions;
CREATE POLICY "Owner can manage brand subscriptions" ON brand_subscriptions
    FOR ALL USING (current_user_role() = 'owner');

-- staff_details: owner sees all; a brand's admin/staff see only their
-- own brand's staff.
DROP POLICY IF EXISTS "Owner and brand admins can view staff" ON staff_details;
CREATE POLICY "Owner and brand admins can view staff" ON staff_details
    FOR SELECT USING (
        current_user_role() = 'owner'
        OR (current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = staff_details.brand_id)
    );

DROP POLICY IF EXISTS "Owner and brand admins can manage staff" ON staff_details;
CREATE POLICY "Owner and brand admins can manage staff" ON staff_details
    FOR ALL USING (
        current_user_role() = 'owner'
        OR (current_user_role() = 'admin' AND current_user_brand_id() = staff_details.brand_id)
    );

-- payroll_records: same shape as staff_details.
DROP POLICY IF EXISTS "Owner and brand admins can view payroll" ON payroll_records;
CREATE POLICY "Owner and brand admins can view payroll" ON payroll_records
    FOR SELECT USING (
        current_user_role() = 'owner'
        OR (current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = payroll_records.brand_id)
    );

DROP POLICY IF EXISTS "Owner and brand admins can manage payroll" ON payroll_records;
CREATE POLICY "Owner and brand admins can manage payroll" ON payroll_records
    FOR ALL USING (
        current_user_role() = 'owner'
        OR (current_user_role() = 'admin' AND current_user_brand_id() = payroll_records.brand_id)
    );
