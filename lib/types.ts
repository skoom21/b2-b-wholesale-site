// Teetoz B2B Wholesale Platform - Database Types
// Auto-generated TypeScript types for Supabase database

// =====================================================
// ENUMS
// =====================================================

export type UserRole = 'admin' | 'retailer' | 'manager';

export type StoreStatus = 'active' | 'pending' | 'inactive' | 'suspended';

export type StoreTier = 'gold' | 'silver' | 'standard';

export type StoreType = 'grocery_store' | 'restaurant' | 'distributor' | 'other';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';

export type OrderStatus = 
  | 'pending'
  | 'processing'
  | 'confirmed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue' | 'refunded';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

// =====================================================
// TABLE TYPES
// =====================================================

export interface User {
  id: string; // UUID
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  last_login_at?: string | null; // timestamptz
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
}

export interface Store {
  id: string; // UUID
  user_id?: string | null; // UUID
  name: string;
  email: string;
  phone?: string | null;
  store_type: StoreType;
  tier: StoreTier;
  status: StoreStatus;
  
  // Address information
  address_line1?: string | null;
  address_line2?: string | null;
  city: string;
  province?: string | null;
  postal_code?: string | null;
  country: string;
  
  // Credit management
  credit_limit: number; // decimal(12, 2)
  credit_used: number; // decimal(12, 2)

  // Payment model
  payment_model?: 'credit' | 'per_order' | 'subscription';
  billing_frequency?: 'weekly' | 'biweekly' | 'monthly' | null;
  next_billing_date?: string | null;

  // Business information
  business_number?: string | null;
  tax_number?: string | null;
  account_manager?: string | null;
  
  // Metadata
  notes?: string | null;
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
}

export interface Category {
  id: string; // UUID
  name: string;
  description?: string | null;
  slug: string;
  parent_id?: string | null; // UUID
  sort_order: number;
  is_active: boolean;
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
}

export interface Product {
  id: string; // UUID
  sku: string;
  name: string;
  description?: string | null;
  category_id?: string | null; // UUID
  
  // Unit and packaging
  unit: string;
  unit_quantity: number;
  
  // Base pricing (standard tier)
  base_price: number; // decimal(10, 2)
  
  // Tier pricing
  gold_price?: number | null; // decimal(10, 2)
  silver_price?: number | null; // decimal(10, 2)
  
  // Cost and margins
  cost_price?: number | null; // decimal(10, 2)
  
  // Stock management
  stock_quantity: number;
  stock_status: StockStatus;
  low_stock_threshold: number;
  reorder_point: number;
  
  // Product details
  weight?: number | null; // decimal(8, 2) - kg
  dimensions_length?: number | null; // decimal(8, 2) - cm
  dimensions_width?: number | null; // decimal(8, 2) - cm
  dimensions_height?: number | null; // decimal(8, 2) - cm
  
  // Product images
  image_url?: string | null;
  image_urls?: string[] | null;
  
  // Metadata
  is_active: boolean;
  featured: boolean;
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
}

export interface Order {
  id: string; // UUID
  order_number: string;
  store_id: string; // UUID
  
  // Order details
  status: OrderStatus;
  
  // Financial information
  subtotal: number; // decimal(12, 2)
  shipping_cost: number; // decimal(10, 2)
  tax_amount: number; // decimal(10, 2)
  discount_amount: number; // decimal(10, 2)
  total_amount: number; // decimal(12, 2)
  
  // Shipping information
  shipping_address_line1?: string | null;
  shipping_address_line2?: string | null;
  shipping_city?: string | null;
  shipping_province?: string | null;
  shipping_postal_code?: string | null;
  shipping_country: string;
  
  // Dates
  order_date: string; // timestamptz
  confirmed_at?: string | null; // timestamptz
  shipped_at?: string | null; // timestamptz
  delivered_at?: string | null; // timestamptz
  cancelled_at?: string | null; // timestamptz
  
  // Notes
  customer_notes?: string | null;
  internal_notes?: string | null;
  
  // Metadata
  created_by?: string | null; // UUID
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
}

export interface OrderItem {
  id: string; // UUID
  order_id: string; // UUID
  product_id: string; // UUID
  
  // Product snapshot (at time of order)
  product_name: string;
  product_sku: string;
  product_unit: string;
  
  // Pricing and quantity
  quantity: number;
  unit_price: number; // decimal(10, 2)
  subtotal: number; // decimal(12, 2)
  
  // Metadata
  created_at: string; // timestamptz
}

export interface Invoice {
  id: string; // UUID
  invoice_number: string;
  order_id?: string | null; // UUID
  store_id: string; // UUID
  
  // Invoice details
  status: InvoiceStatus;
  
  // Financial information
  subtotal: number; // decimal(12, 2)
  tax_amount: number; // decimal(10, 2)
  total_amount: number; // decimal(12, 2)
  amount_paid: number; // decimal(12, 2)
  
  // Dates
  invoice_date: string; // date
  due_date: string; // date
  paid_at?: string | null; // timestamptz
  
  // Payment information
  payment_method?: string | null;
  payment_reference?: string | null;
  
  // Notes
  notes?: string | null;
  
  // Metadata
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
}

export interface InventoryTransaction {
  id: string; // UUID
  product_id: string; // UUID
  
  // Transaction details
  transaction_type: string; // 'purchase', 'sale', 'adjustment', 'return', 'damage'
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  
  // Reference
  reference_type?: string | null; // 'order', 'manual', 'return'
  reference_id?: string | null; // UUID
  
  // Notes
  notes?: string | null;
  
  // Metadata
  created_by?: string | null; // UUID
  created_at: string; // timestamptz
}

export interface ActivityLog {
  id: string; // UUID
  user_id?: string | null; // UUID
  
  // Activity details
  action: string; // 'create', 'update', 'delete', 'login', etc.
  entity_type: string; // 'order', 'product', 'store', etc.
  entity_id?: string | null; // UUID
  
  // Changes
  old_values?: Record<string, any> | null; // JSONB
  new_values?: Record<string, any> | null; // JSONB
  
  // Context
  ip_address?: string | null;
  user_agent?: string | null;
  
  // Metadata
  created_at: string; // timestamptz
}

export interface StoreCreditHistory {
  id: string; // UUID
  store_id: string; // UUID
  
  // Credit change
  amount: number; // decimal(12, 2)
  balance_before: number; // decimal(12, 2)
  balance_after: number; // decimal(12, 2)
  
  // Reference
  transaction_type: string; // 'order', 'payment', 'adjustment'
  reference_type?: string | null;
  reference_id?: string | null; // UUID
  
  // Notes
  notes?: string | null;
  
  // Metadata
  created_by?: string | null; // UUID
  created_at: string; // timestamptz
}

// =====================================================
// VIEW TYPES
// =====================================================

export interface ProductCatalogView extends Product {
  category_name?: string | null;
  category_slug?: string | null;
}

export interface OrderSummaryView extends Order {
  store_name: string;
  store_tier: StoreTier;
  item_count: number;
  created_by_name?: string | null;
}

export interface LowStockProductView extends Product {
  category_name?: string | null;
}

export interface StoreCreditSummaryView {
  id: string; // UUID
  name: string;
  tier: StoreTier;
  credit_limit: number; // decimal(12, 2)
  credit_used: number; // decimal(12, 2)
  credit_available: number; // decimal(12, 2)
  credit_utilization_percent: number; // decimal
}

// =====================================================
// COMPOSITE TYPES (JOIN RESULTS)
// =====================================================

export interface OrderWithItems extends Order {
  items: OrderItem[];
  store?: Store;
}

export interface ProductWithCategory extends Product {
  category?: Category | null;
}

export interface StoreWithUser extends Store {
  user?: User | null;
}

export interface InvoiceWithOrder extends Invoice {
  order?: Order | null;
  store?: Store;
}

// =====================================================
// INSERT/UPDATE TYPES (without auto-generated fields)
// =====================================================

export type UserInsert = Omit<User, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
};

export type UserUpdate = Partial<Omit<User, 'id' | 'created_at'>>;

export type StoreInsert = Omit<Store, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type StoreUpdate = Partial<Omit<Store, 'id' | 'created_at'>>;

export type CategoryInsert = Omit<Category, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type CategoryUpdate = Partial<Omit<Category, 'id' | 'created_at'>>;

export type ProductInsert = Omit<Product, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ProductUpdate = Partial<Omit<Product, 'id' | 'created_at'>>;

export type OrderInsert = Omit<Order, 'id' | 'order_number' | 'created_at' | 'updated_at'> & {
  id?: string;
  order_number?: string;
  created_at?: string;
  updated_at?: string;
};

export type OrderUpdate = Partial<Omit<Order, 'id' | 'order_number' | 'created_at'>>;

export type OrderItemInsert = Omit<OrderItem, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type InvoiceInsert = Omit<Invoice, 'id' | 'invoice_number' | 'created_at' | 'updated_at'> & {
  id?: string;
  invoice_number?: string;
  created_at?: string;
  updated_at?: string;
};

export type InvoiceUpdate = Partial<Omit<Invoice, 'id' | 'invoice_number' | 'created_at'>>;

export type InventoryTransactionInsert = Omit<InventoryTransaction, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type ActivityLogInsert = Omit<ActivityLog, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type StoreCreditHistoryInsert = Omit<StoreCreditHistory, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

// =====================================================
// HELPER TYPES
// =====================================================

// Product pricing helper
export interface ProductPricing {
  standard: number;
  silver?: number;
  gold?: number;
}

// Order status display helper
export interface OrderStatusDisplay {
  label: string;
  color: 'green' | 'yellow' | 'red' | 'gray';
  icon?: string;
}

// Stock status display helper
export interface StockStatusDisplay {
  label: string;
  badge: string;
  color: 'green' | 'yellow' | 'red' | 'gray';
}

// Financial summary helper
export interface FinancialSummary {
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
}

// Pagination helper
export interface PaginationParams {
  page: number;
  per_page: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

// Filter types
export interface ProductFilter {
  category_id?: string;
  stock_status?: StockStatus;
  is_active?: boolean;
  search?: string;
  min_price?: number;
  max_price?: number;
}

export interface OrderFilter {
  store_id?: string;
  status?: OrderStatus;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface StoreFilter {
  status?: StoreStatus;
  tier?: StoreTier;
  store_type?: StoreType;
  city?: string;
  search?: string;
}

// =====================================================
// SUPABASE DATABASE TYPE (for supabase-js)
// =====================================================

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: UserInsert;
        Update: UserUpdate;
      };
      stores: {
        Row: Store;
        Insert: StoreInsert;
        Update: StoreUpdate;
      };
      categories: {
        Row: Category;
        Insert: CategoryInsert;
        Update: CategoryUpdate;
      };
      products: {
        Row: Product;
        Insert: ProductInsert;
        Update: ProductUpdate;
      };
      orders: {
        Row: Order;
        Insert: OrderInsert;
        Update: OrderUpdate;
      };
      order_items: {
        Row: OrderItem;
        Insert: OrderItemInsert;
        Update: Partial<OrderItem>;
      };
      invoices: {
        Row: Invoice;
        Insert: InvoiceInsert;
        Update: InvoiceUpdate;
      };
      inventory_transactions: {
        Row: InventoryTransaction;
        Insert: InventoryTransactionInsert;
        Update: Partial<InventoryTransaction>;
      };
      activity_logs: {
        Row: ActivityLog;
        Insert: ActivityLogInsert;
        Update: Partial<ActivityLog>;
      };
      store_credit_history: {
        Row: StoreCreditHistory;
        Insert: StoreCreditHistoryInsert;
        Update: Partial<StoreCreditHistory>;
      };
    };
    Views: {
      product_catalog: {
        Row: ProductCatalogView;
      };
      order_summary: {
        Row: OrderSummaryView;
      };
      low_stock_products: {
        Row: LowStockProductView;
      };
      store_credit_summary: {
        Row: StoreCreditSummaryView;
      };
    };
    Functions: {
      generate_order_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      generate_invoice_number: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      store_status: StoreStatus;
      store_tier: StoreTier;
      store_type: StoreType;
      stock_status: StockStatus;
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      invoice_status: InvoiceStatus;
    };
  };
}
