-- Several tables in this project only ever got a SELECT policy, so no one
-- (not even admins) can write to them via the app despite normal app
-- features needing to. This file fixes each one as they were found:
--   1. store_credit_history: retailer credit requests + admin approvals.
--   2. invoices: auto-created when an order is placed, so retailers see
--      what they owe.
--   3. inventory_transactions: written by a DB trigger whenever an order's
--      status changes (confirm/ship/deliver), so without this every status
--      change in admin Order Fulfillment fails.
--   4. stores: retailers had SELECT on their own store but never UPDATE,
--      so Settings -> Save Changes failed for every retailer with
--      "Cannot coerce the result to a single JSON object" (RLS silently
--      matches 0 rows rather than a clear permission error).
--   5. activity_logs: a trigger (log_activity) fires on every insert/
--      update/delete on orders, products, and stores and writes here.
--      Only a SELECT policy exists; added defensively since it's the
--      exact same gap as the other four and would surface the same way.

CREATE POLICY "Retailers can request credit for their own store" ON store_credit_history
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM stores
            WHERE stores.id = store_credit_history.store_id
            AND stores.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage credit history" ON store_credit_history
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- invoices currently only has a SELECT policy too, so an order can't
-- auto-generate its own invoice (the dues/balance shown to retailers).
-- This lets a retailer's own order-placement create an invoice for
-- their own store; admins can already manage invoices separately.
CREATE POLICY "Retailers can create an invoice for their own order" ON invoices
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM stores
            WHERE stores.id = invoices.store_id
            AND stores.user_id = auth.uid()
        )
    );

-- inventory_transactions has the exact same gap: only a SELECT policy
-- exists. A trigger on orders (update_product_stock, fires AFTER UPDATE
-- OF status) writes a row here whenever an admin confirms/ships/delivers
-- an order, so without this, every status change in Order Fulfillment
-- fails with "new row violates row-level security policy for table
-- inventory_transactions".
CREATE POLICY "Admins can log inventory transactions" ON inventory_transactions
    FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- stores had SELECT for retailers on their own row but no UPDATE policy,
-- so Settings -> Save Changes failed for every retailer.
CREATE POLICY "Retailers can update their own store" ON stores
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- activity_logs: see note above. Any authenticated write is fine here —
-- it's an audit trail, so broad INSERT + admin-only SELECT is the right
-- shape (matches the existing "Admins can view activity logs" policy).
CREATE POLICY "Authenticated users can log activity" ON activity_logs
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
