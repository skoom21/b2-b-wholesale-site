-- Allows the credit request/approval feature to work.
-- store_credit_history currently only has a SELECT policy (schema.sql line ~811),
-- so no one — not even admins — can INSERT/UPDATE rows in it via the app.
-- This adds:
--   1. Retailers can insert a credit request row for their own store.
--   2. Admins/managers can insert/update/delete rows (approve/reject requests,
--      log direct credit adjustments).

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
