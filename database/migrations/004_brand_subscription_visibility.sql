-- =====================================================================
-- brand_subscriptions was owner-only RLS (no admin/staff access at all),
-- which was fine when there was no UI for a brand admin to see their own
-- subscription. Now there is, so brand admins/staff need read access to
-- their own brand's subscription rows. Still no write access — only the
-- platform owner sets/changes pricing and status.
--
-- Idempotent — safe to run more than once.
-- =====================================================================

DROP POLICY IF EXISTS "Admins/staff can view their brand's subscription" ON brand_subscriptions;
CREATE POLICY "Admins/staff can view their brand's subscription" ON brand_subscriptions
    FOR SELECT USING (
        current_user_role() IN ('admin', 'staff') AND current_user_brand_id() = brand_subscriptions.brand_id
    );
