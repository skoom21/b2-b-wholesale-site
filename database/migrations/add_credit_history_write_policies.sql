-- Several tables in this project only ever got a SELECT policy, so no one
-- (not even admins) can write to them via the app despite normal app
-- features needing to. This file fixes each one as they were found:
--   1. store_credit_history: retailer credit requests + admin approvals.
--   2. invoices: auto-created when an order is placed, so retailers see
--      what they owe.
--   3. inventory_transactions: written by a DB trigger whenever an order's
--      status changes (confirm/ship/deliver), so without this every status
--      change in admin Order Fulfillment fails.

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
