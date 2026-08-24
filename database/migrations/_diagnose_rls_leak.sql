-- DIAGNOSTIC ONLY — not a migration, just run this and send me the result.
-- Lists every RLS policy currently active on stores/users/products so I can
-- see exactly what's live, rather than guessing from migration files that
-- may not perfectly match what actually got applied.

SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('stores', 'users', 'products')
ORDER BY tablename, policyname;
