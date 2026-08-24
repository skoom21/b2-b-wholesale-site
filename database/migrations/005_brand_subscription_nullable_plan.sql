-- =====================================================================
-- brand_subscriptions.plan_name was NOT NULL, which silently broke the
-- new "every brand gets a 7-day trial on creation, pricing can be set
-- later" flow — creating a brand with no plan_name yet threw a DB error
-- that wasn't being surfaced, so no trial subscription row was created
-- at all. plan_name can legitimately be unset until the owner picks a
-- plan, so it needs to be nullable.
--
-- Idempotent — safe to run more than once.
-- =====================================================================

ALTER TABLE brand_subscriptions ALTER COLUMN plan_name DROP NOT NULL;
