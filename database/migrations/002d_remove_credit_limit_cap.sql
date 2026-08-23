-- =====================================================================
-- Removes the hard credit-limit cap that's crashing order confirmation
-- in production right now.
--
-- credit_used_within_limit CHECK (credit_used <= credit_limit) blocks
-- confirming ANY order for a store whose credit_limit hasn't been
-- manually raised above $0 (the default for every new store) — this is
-- why confirming Village Bakers' order failed with "violates check
-- constraint credit_used_within_limit".
--
-- Per the new credit model: credit_used tracks dues owed, not a spending
-- cap. There is no limit to enforce — retailers can order regardless,
-- and dues get paid down via recorded payments (in-app or in-store).
--
-- Idempotent — safe to run more than once.
-- =====================================================================

ALTER TABLE stores DROP CONSTRAINT IF EXISTS credit_used_within_limit;
