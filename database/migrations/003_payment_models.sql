-- =====================================================================
-- Phase 1 of the comprehensive payment system: formalizes three payment
-- models per store on top of the existing dues ledger (stores.credit_used
-- + store_credit_history). No Stripe/real money yet — that's phases 2-3.
--
-- Idempotent — safe to run more than once. Uses the same SECURITY
-- DEFINER helper functions from 002_multi_tenant_foundation.sql
-- (current_user_role/current_user_brand_id) to avoid the RLS
-- self-recursion issue fixed earlier.
-- =====================================================================

DO $$ BEGIN
    CREATE TYPE payment_model AS ENUM ('credit', 'per_order', 'subscription');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE billing_frequency AS ENUM ('weekly', 'biweekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_model_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---------------------------------------------------------------------
-- 1. stores columns
-- ---------------------------------------------------------------------
ALTER TABLE stores ADD COLUMN IF NOT EXISTS payment_model payment_model NOT NULL DEFAULT 'credit';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS billing_frequency billing_frequency;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS next_billing_date DATE;

CREATE INDEX IF NOT EXISTS idx_stores_payment_model ON stores(payment_model);


-- ---------------------------------------------------------------------
-- 2. payment_model_requests table (mirrors the existing credit-request
--    pattern in store_credit_history, but as its own table since a
--    model change isn't a credit/ledger transaction)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_model_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    current_model payment_model NOT NULL,
    requested_model payment_model NOT NULL,
    requested_billing_frequency billing_frequency,
    status payment_model_request_status NOT NULL DEFAULT 'pending',
    reason TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_model_requests_store_id ON payment_model_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_payment_model_requests_status ON payment_model_requests(status);

ALTER TABLE payment_model_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their store's model requests" ON payment_model_requests;
CREATE POLICY "Users can view their store's model requests" ON payment_model_requests
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = payment_model_requests.store_id AND stores.user_id = auth.uid())
        OR current_user_role() = 'owner'
        OR EXISTS (
            SELECT 1 FROM stores WHERE stores.id = payment_model_requests.store_id
            AND current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = stores.brand_id
        )
    );

DROP POLICY IF EXISTS "Retailers can request a model change for their own store" ON payment_model_requests;
CREATE POLICY "Retailers can request a model change for their own store" ON payment_model_requests
    FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM stores WHERE stores.id = payment_model_requests.store_id AND stores.user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Admins/staff can manage their brand's model requests" ON payment_model_requests;
CREATE POLICY "Admins/staff can manage their brand's model requests" ON payment_model_requests
    FOR ALL USING (
        current_user_role() = 'owner'
        OR EXISTS (
            SELECT 1 FROM stores WHERE stores.id = payment_model_requests.store_id
            AND current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = stores.brand_id
        )
    );
