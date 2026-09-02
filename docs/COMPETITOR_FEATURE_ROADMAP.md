# Pallet competitor feature roadmap

Research baseline: inFlow Inventory, Cin7 Core, Zoho Inventory, and Shopify B2B.

## Already available in Pallet

- Multi-tenant brand workspaces and owner controls
- Product catalog, stock levels, adjustments, and low-stock status
- Retailer accounts, tier pricing, order history, and self-service ordering
- Order processing, invoices, dues, manual payment records, and reports
- Staff records, payroll records, subscription tracking, and public brand catalogs
- Predictive inventory planner with demand forecasts, ABC classification, stockout risk, days of cover, and reorder recommendations

## Phase 1 — wholesale operations

- Suppliers, contacts, supplier price lists, and lead times
- Purchase orders, partial receiving, supplier bills, and outstanding payables
- Multiple warehouses, bins, stock transfers, and stocktakes
- Product cost history, landed cost, COGS, gross profit, and margin reporting
- Returns, refunds, damaged goods, and return merchandise authorization

## Phase 2 — traceability and fulfillment

- Barcode generation and scanning
- Batch, lot, serial number, and expiry-date tracking
- Picklists, packing, shipping labels, shipment tracking, and backorders
- Kits, bundles, composite products, and bills of materials
- Customer-specific catalogs, quantity rules, deposits, and Net 7/15/30/45/60/90 terms

## Phase 3 — automation and integrations

- QuickBooks/Xero accounting sync
- Shopify/WooCommerce marketplace sync
- Carrier and payment integrations
- Email/SMS reminders, approval workflows, webhooks, and public API
- Import/export centre with validation and reusable templates

## Phase 4 — advanced intelligence

- Seasonal demand forecasting and supplier-aware replenishment
- Multi-location inventory optimization
- Cash tied up in slow stock and expiry-loss prediction
- Customer churn, late-payment, and next-best-product recommendations
- Natural-language business assistant with citations to the brand's own records

Each phase requires database, API, interface, tenant-isolation, migration, and end-to-end QA work. Features should ship phase-by-phase rather than as one unsafe migration.
