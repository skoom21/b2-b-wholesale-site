-- Public storefront foundation for each wholesale brand.
-- Safe to run more than once.

ALTER TABLE brands ADD COLUMN IF NOT EXISTS public_catalog_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS public_description TEXT;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_url TEXT;

DROP POLICY IF EXISTS "Public can view enabled brand storefronts" ON brands;
CREATE POLICY "Public can view enabled brand storefronts" ON brands
    FOR SELECT USING (status = 'active' AND public_catalog_enabled = true);

DROP POLICY IF EXISTS "Public can view storefront products" ON products;
CREATE POLICY "Public can view storefront products" ON products
    FOR SELECT USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM brands
            WHERE brands.id = products.brand_id
              AND brands.status = 'active'
              AND brands.public_catalog_enabled = true
        )
    );

DROP POLICY IF EXISTS "Public can view storefront categories" ON categories;
CREATE POLICY "Public can view storefront categories" ON categories
    FOR SELECT USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM brands
            WHERE brands.id = categories.brand_id
              AND brands.status = 'active'
              AND brands.public_catalog_enabled = true
        )
    );
