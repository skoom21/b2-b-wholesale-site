import type { StoreStatus } from './types'

// API Client utilities for making authenticated requests

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    console.log('[API Client] Fetching:', endpoint)
    const response = await fetch(endpoint, {
      ...options,
      credentials: 'include', // Include auth cookies
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    console.log('[API Client] Response status:', response.status)
    const data = await response.json()

    if (!response.ok) {
      console.error('[API Client] Error response:', data)
      throw new ApiError(
        data.error?.message || 'An error occurred',
        data.error?.code || 'UNKNOWN_ERROR',
        response.status,
        data.error?.details
      )
    }

    console.log('[API Client] Success:', endpoint)
    return data.data as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    
    // Network or other errors
    console.error('[API Client] Network error:', error)
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      'NETWORK_ERROR',
      0
    )
  }
}

// Dashboard API
export async function fetchDashboardData() {
  return apiClient<{
    store: {
      id: string
      name: string
      tier: 'gold' | 'silver' | 'standard'
      status: string
      credit_limit: number
      credit_used: number
      credit_available: number
    }
    stats: {
      total_orders: number
      active_orders: number
      total_spent: number
      low_stock_alerts: number
      unpaid_invoices: number
      unpaid_amount: number
    }
    recent_orders: any[]
    unpaid_invoices: any[]
    low_stock_products: any[]
  }>('/api/dashboard/retailer')
}

// Products API
export async function fetchProducts(params?: {
  page?: number
  limit?: number
  category_id?: string
  stock_status?: string
  search?: string
  sort?: string
}) {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.category_id) searchParams.set('category_id', params.category_id)
  if (params?.stock_status) searchParams.set('stock_status', params.stock_status)
  if (params?.search) searchParams.set('search', params.search)
  if (params?.sort) searchParams.set('sort', params.sort)

  const url = `/api/products${searchParams.toString() ? `?${searchParams}` : ''}`
  
  const response = await fetch(url, { credentials: 'include' })
  const data = await response.json()
  
  if (!response.ok) {
    throw new ApiError(
      data.error?.message || 'Failed to fetch products',
      data.error?.code || 'FETCH_ERROR',
      response.status
    )
  }
  
  return {
    products: data.data,
    pagination: data.meta
  }
}

export async function fetchProduct(id: string) {
  return apiClient(`/api/products/${id}`)
}

// Categories API
export async function fetchCategories(flat = false) {
  const url = `/api/categories${flat ? '?flat=true' : ''}`
  return apiClient<any[]>(url)
}

// Orders API
export async function fetchOrders(params?: {
  page?: number
  limit?: number
  status?: string
  start_date?: string
  end_date?: string
}) {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.status) searchParams.set('status', params.status)
  if (params?.start_date) searchParams.set('start_date', params.start_date)
  if (params?.end_date) searchParams.set('end_date', params.end_date)

  const url = `/api/orders${searchParams.toString() ? `?${searchParams}` : ''}`
  
  const response = await fetch(url, { credentials: 'include' })
  const data = await response.json()
  
  if (!response.ok) {
    console.error('[API Client] Orders fetch failed:', response.status, data)
    throw new ApiError(
      data.error?.message || 'Failed to fetch orders',
      data.error?.code || 'FETCH_ERROR',
      response.status
    )
  }
  
  console.log('[API Client] Orders response:', data)
  return {
    orders: data.data,
    pagination: data.meta
  }
}

export async function fetchOrder(id: string) {
  return apiClient(`/api/orders/${id}`)
}

export async function createOrder(data: {
  items: Array<{ product_id: string; quantity: number }>
  shipping_cost?: number
  notes?: string
}) {
  return apiClient('/api/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Admin/staff logging a walk-in order for a store that ordered in
// person, not through the retailer's own checkout.
export async function createManualOrder(storeId: string, data: {
  items: Array<{ product_id: string; quantity: number }>
  shipping_cost?: number
  customer_notes?: string
}) {
  return apiClient('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ ...data, store_id: storeId }),
  })
}

export async function cancelOrder(id: string) {
  return apiClient(`/api/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'cancelled' }),
  })
}

export async function updateOrderStatus(id: string, status: string) {
  return apiClient(`/api/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

// Store API
export async function fetchStore(id: string) {
  return apiClient(`/api/stores/${id}`)
}

export async function updateStore(id: string, data: {
  name?: string
  phone?: string
  address?: string
  city?: string
  province?: string
  postal_code?: string
  website?: string
  status?: StoreStatus
  credit_limit?: number
  payment_model?: 'credit' | 'per_order' | 'subscription'
  billing_frequency?: 'weekly' | 'biweekly' | 'monthly'
}) {
  return apiClient(`/api/stores/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// Payment Model Requests API
export type PaymentModelRequest = {
  id: string
  store_id?: string
  current_model: 'credit' | 'per_order' | 'subscription'
  requested_model: 'credit' | 'per_order' | 'subscription'
  requested_billing_frequency: 'weekly' | 'biweekly' | 'monthly' | null
  status: 'pending' | 'approved' | 'rejected'
  reason: string | null
  created_at: string
  stores?: { id: string; name: string; email: string; payment_model: string }
}

export async function fetchPaymentModelRequests() {
  return apiClient<{ requests: PaymentModelRequest[] }>('/api/payment-model-requests')
}

export async function submitPaymentModelRequest(data: {
  requested_model: 'credit' | 'per_order' | 'subscription'
  requested_billing_frequency?: 'weekly' | 'biweekly' | 'monthly'
  reason?: string
}) {
  return apiClient('/api/payment-model-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function resolvePaymentModelRequest(id: string, action: 'approve' | 'reject') {
  return apiClient(`/api/payment-model-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  })
}

// Store dues payments — records a payment (in-store cash, or a retailer
// self-reporting an in-system payment) against a store's owed balance.
// Applies immediately; there's no real payment processor behind this.
export async function recordStorePayment(storeId: string, data: { amount: number; notes?: string }) {
  return apiClient<{ credit_used: number; entry: any }>(`/api/stores/${storeId}/payments`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function fetchStorePayments(storeId: string) {
  return apiClient<{ payments: any[] }>(`/api/stores/${storeId}/payments`)
}

export async function fetchMySubscription() {
  return apiClient<{ subscription: {
    id: string
    plan_name: string | null
    billing_interval: 'monthly' | 'yearly'
    amount: number
    status: 'trialing' | 'active' | 'past_due' | 'cancelled'
    current_period_start: string
    current_period_end: string
  } | null }>('/api/admin/subscription')
}

// Credit Requests API
export type CreditRequest = {
  id: string
  store_id?: string
  amount: number
  balance_before: number
  balance_after: number
  transaction_type: 'credit_request_pending' | 'credit_request_approved' | 'credit_request_rejected'
  notes: string | null
  public_catalog_enabled?: boolean
  public_description?: string | null
  logo_url?: string | null
  created_at: string
  stores?: { id: string; name: string; email: string; credit_limit: number }
}

export async function fetchCreditRequests() {
  return apiClient<{ requests: CreditRequest[] }>('/api/credit-requests')
}

export async function submitCreditRequest(requested_limit: number, reason?: string) {
  return apiClient('/api/credit-requests', {
    method: 'POST',
    body: JSON.stringify({ requested_limit, reason }),
  })
}

export async function resolveCreditRequest(id: string, action: 'approve' | 'reject') {
  return apiClient(`/api/credit-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  })
}

// Invoices API
export async function fetchInvoices(params?: {
  page?: number
  limit?: number
  status?: string
}) {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.status) searchParams.set('status', params.status)

  const url = `/api/invoices${searchParams.toString() ? `?${searchParams}` : ''}`
  
  const response = await fetch(url, { credentials: 'include' })
  const data = await response.json()
  
  if (!response.ok) {
    throw new ApiError(
      data.error?.message || 'Failed to fetch invoices',
      data.error?.code || 'FETCH_ERROR',
      response.status
    )
  }
  
  return {
    invoices: data.data.invoices,
    pagination: data.data.pagination
  }
}

export async function fetchInvoice(id: string) {
  return apiClient(`/api/invoices/${id}`)
}

// Admin Dashboard API
export async function fetchAdminDashboardData() {
  return apiClient<{
    stats: {
      stores: {
        total: number
        active: number
        pending: number
        tiers: {
          gold: number
          silver: number
          standard: number
        }
      }
      orders: {
        total: number
        pending: number
        processing: number
      }
      revenue: {
        total: number
        monthly: number
      }
      products: {
        total: number
        active: number
        out_of_stock: number
        low_stock: number
      }
      invoices: {
        overdue_count: number
        overdue_amount: number
      }
    }
    recent_orders: any[]
    low_stock_products: any[]
    pending_stores: any[]
    overdue_invoices: any[]
  }>('/api/dashboard/admin')
}

// Admin Stores API
export async function fetchStores(params?: {
  page?: number
  limit?: number
  status?: string
  tier?: string
  store_type?: string
  search?: string
}) {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.status) searchParams.set('status', params.status)
  if (params?.tier) searchParams.set('tier', params.tier)
  if (params?.store_type) searchParams.set('store_type', params.store_type)
  if (params?.search) searchParams.set('search', params.search)

  const url = `/api/stores${searchParams.toString() ? `?${searchParams}` : ''}`
  
  const response = await fetch(url, { credentials: 'include' })
  const data = await response.json()
  
  if (!response.ok) {
    throw new ApiError(
      data.error?.message || 'Failed to fetch stores',
      data.error?.code || 'FETCH_ERROR',
      response.status
    )
  }
  
  return {
    stores: data.data?.stores || data.data || [],
    pagination: data.meta || data.data?.pagination
  }
}

// Admin Reports API
export async function fetchReports() {
  return apiClient<{
    monthly_revenue: { month: string; revenue: number }[]
    revenue_by_type: Record<string, number>
    top_sellers: { product_id: string; name: string; sku: string; quantity: number; revenue: number }[]
    bottom_sellers: { product_id: string; name: string; sku: string; quantity: number; revenue: number }[]
    no_sales_this_month: { id: string; name: string; sku: string }[]
    this_month_revenue: number
    last_month_revenue: number
    revenue_change_pct: number | null
    insights: string[]
    current_month_label: string
  }>('/api/reports')
}

// Retailer Reports API
export async function fetchRetailerReports() {
  return apiClient<{
    store_name: string
    monthly_spend: { month: string; spend: number }[]
    most_purchased: { product_id: string; name: string; sku: string; quantity: number; spend: number }[]
    total_orders_6mo: number
    total_spend_6mo: number
    avg_order_value: number
  }>('/api/reports/retailer')
}

// Admin Products API (for inventory management)
export async function updateProduct(id: string, data: {
  name?: string
  sku?: string
  base_price?: number
  gold_price?: number | null
  silver_price?: number | null
  stock_quantity?: number
  low_stock_threshold?: number
  is_active?: boolean
  stock_change_notes?: string
}) {
  return apiClient(`/api/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function createProduct(data: {
  sku: string
  name: string
  category_id: string
  description?: string
  base_price: number
  gold_price?: number
  silver_price?: number
  stock_quantity?: number
  low_stock_threshold?: number
  image_url?: string
  is_active?: boolean
  is_featured?: boolean
}) {
  return apiClient('/api/products', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteProduct(id: string) {
  return apiClient(`/api/products/${id}`, {
    method: 'DELETE',
  })
}

export async function bulkDeleteProducts(ids: string[]) {
  return apiClient('/api/products', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  })
}

// Owner API — brands
export type Brand = {
  id: string
  slug: string
  name: string
  status: 'active' | 'suspended' | 'cancelled'
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  created_at: string
  store_count?: number
  admin_email?: string | null
  brand_subscriptions?: {
    id: string
    plan_name: string
    billing_interval: 'monthly' | 'yearly'
    amount: number
    status: 'trialing' | 'active' | 'past_due' | 'cancelled'
    current_period_end: string
  }[]
}

export async function fetchBrands() {
  return apiClient<{ brands: Brand[] }>('/api/owner/brands')
}

export async function fetchBrand(id: string) {
  return apiClient<{
    brand: Brand
    staff: any[]
    admins: { id: string; email: string; full_name: string; phone: string | null; is_active: boolean; last_login_at: string | null; created_at: string }[]
    counts: { stores: number; products: number; orders: number }
  }>(`/api/owner/brands/${id}`)
}

export async function createBrandAdmin(brandId: string, data: { email: string; full_name: string }) {
  return apiClient<{ admin_account: { id: string; email: string; temp_password: string } }>(
    `/api/owner/brands/${brandId}/admin`,
    { method: 'POST', body: JSON.stringify(data) }
  )
}

export async function sendBrandAdminPasswordReset(email: string) {
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

export async function createBrand(data: {
  name: string
  slug: string
  admin_email: string
  admin_full_name: string
  contact_email?: string
  contact_phone?: string
  plan_name?: string
  billing_interval?: 'monthly' | 'yearly'
  amount?: number
  notes?: string
}) {
  return apiClient<{ brand: Brand; admin_account: { id: string; email: string; temp_password: string } | null; admin_account_error?: string }>('/api/owner/brands', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateBrand(id: string, data: {
  name?: string
  status?: 'active' | 'suspended' | 'cancelled'
  contact_email?: string
  contact_phone?: string
  notes?: string
  subscription?: {
    plan_name?: string
    billing_interval?: 'monthly' | 'yearly'
    amount?: number
    status?: 'trialing' | 'active' | 'past_due' | 'cancelled'
    current_period_end?: string
  }
}) {
  return apiClient<{ brand: Brand }>(`/api/owner/brands/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// Admin API — staff
export type StaffMember = {
  id: string
  user_id: string
  brand_id: string
  job_title: string | null
  pay_type: 'hourly' | 'salary'
  pay_rate: number
  employment_status: 'active' | 'on_leave' | 'terminated'
  hire_date: string
  users?: { id: string; email: string; full_name: string; role: string; is_active: boolean }
}

export async function fetchStaff() {
  return apiClient<{ staff: StaffMember[] }>('/api/admin/staff')
}

export async function createStaff(data: {
  email: string
  full_name: string
  phone?: string
  job_title?: string
  pay_type?: 'hourly' | 'salary'
  pay_rate?: number
  hire_date?: string
}) {
  return apiClient<{ staff: StaffMember; account: { id: string; email: string; temp_password: string } }>('/api/admin/staff', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Admin API — payroll
export type PayrollRecord = {
  id: string
  staff_id: string
  brand_id: string
  period_start: string
  period_end: string
  gross_amount: number
  deductions: number
  net_amount: number
  status: 'open' | 'processed' | 'paid'
  paid_at: string | null
  staff_details?: { id: string; job_title: string | null; users: { id: string; full_name: string; email: string } }
}

export async function fetchPayrollRecords(staffId?: string) {
  const qs = staffId ? `?staff_id=${staffId}` : ''
  return apiClient<{ records: PayrollRecord[] }>(`/api/admin/payroll${qs}`)
}

export async function createPayrollRecord(data: {
  staff_id: string
  period_start: string
  period_end: string
  gross_amount: number
  deductions?: number
  notes?: string
}) {
  return apiClient<{ record: PayrollRecord }>('/api/admin/payroll', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updatePayrollStatus(id: string, status: 'open' | 'processed' | 'paid') {
  return apiClient<{ record: PayrollRecord }>(`/api/admin/payroll/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
