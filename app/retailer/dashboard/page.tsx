"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { TrendingUp, ShoppingCart, AlertCircle, CreditCard, DollarSign, Package, Clock } from "lucide-react"
import { fetchDashboardData, fetchCreditRequests, submitCreditRequest, ApiError, type CreditRequest } from "@/lib/api-client"
import { useUser } from "@/hooks/use-user"

export default function RetailerDashboard() {
  const { store: userStore } = useUser()
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [pendingRequest, setPendingRequest] = useState<CreditRequest | null>(null)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [requestedAmount, setRequestedAmount] = useState("")
  const [requestReason, setRequestReason] = useState("")
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        console.log('[Dashboard] Starting to load dashboard data...')
        setIsLoading(true)
        const data = await fetchDashboardData()
        console.log('[Dashboard] Data loaded:', data)
        setDashboardData(data)
        setError(null)
      } catch (err) {
        console.error('[Dashboard] Error loading dashboard:', err)
        if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError('Failed to load dashboard data')
        }
      } finally {
        console.log('[Dashboard] Loading complete, setting isLoading to false')
        setIsLoading(false)
      }
    }

    const loadCreditRequests = async () => {
      try {
        const data = await fetchCreditRequests()
        const pending = (data.requests || []).find(r => r.transaction_type === 'credit_request_pending')
        setPendingRequest(pending || null)
      } catch (err) {
        console.error('[Dashboard] Failed to load credit requests:', err)
      }
    }

    loadDashboard()
    loadCreditRequests()
  }, [])

  const handleSubmitCreditRequest = async () => {
    const amount = parseFloat(requestedAmount)
    if (isNaN(amount) || amount <= 0) {
      setRequestError("Enter a valid amount")
      return
    }
    try {
      setSubmittingRequest(true)
      setRequestError(null)
      await submitCreditRequest(amount, requestReason || undefined)
      setPendingRequest({
        id: 'optimistic',
        amount: 0,
        balance_before: dashboardData?.store?.credit_limit || 0,
        balance_after: amount,
        transaction_type: 'credit_request_pending',
        notes: requestReason || null,
        created_at: new Date().toISOString(),
      })
      setShowRequestForm(false)
      setRequestedAmount("")
      setRequestReason("")
    } catch (err: any) {
      setRequestError(err.message || "Failed to submit request")
    } finally {
      setSubmittingRequest(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive px-6 py-4 rounded-lg">
        <p className="font-medium">Error loading dashboard</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    )
  }

  if (!dashboardData) {
    return null
  }

  const { store, stats, recent_orders, unpaid_invoices, low_stock_products } = dashboardData

  const creditPercentage = store.credit_limit > 0 ? (store.credit_used / store.credit_limit) * 100 : 0
  const creditColor = creditPercentage > 90 ? 'bg-red-500' : creditPercentage > 75 ? 'bg-yellow-500' : 'bg-green-500'

  const statCards = [
    { 
      label: "Total Spent", 
      value: `$${stats.total_spent.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      icon: DollarSign,
      color: "text-green-600"
    },
    { 
      label: "Active Orders", 
      value: stats.active_orders, 
      icon: ShoppingCart,
      color: "text-blue-600"
    },
    { 
      label: "Stock Alerts", 
      value: stats.low_stock_alerts, 
      icon: AlertCircle,
      color: "text-orange-600"
    },
    {
      label: "Amount Due",
      value: `$${(stats.unpaid_amount || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtext: `${stats.unpaid_invoices} unpaid invoice${stats.unpaid_invoices === 1 ? '' : 's'}`,
      icon: CreditCard,
      color: "text-red-600"
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "status-green"
      case "shipped":
        return "status-yellow"
      case "confirmed":
        return "status-blue"
      case "processing":
        return "status-yellow"
      case "pending":
        return "status-gray"
      case "cancelled":
        return "status-red"
      default:
        return "status-gray"
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      delivered: "Delivered",
      shipped: "Shipped",
      confirmed: "Confirmed",
      processing: "Processing",
      pending: "Pending",
      cancelled: "Cancelled",
    }
    return labels[status] || status
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-secondary mb-2">Welcome Back{store?.name ? `, ${store.name}` : ''}</h1>
        <p className="text-muted-foreground">Manage your orders and track inventory</p>
        {store?.tier && (
          <p className="text-sm text-primary font-medium mt-1">
            {store.tier.charAt(0).toUpperCase() + store.tier.slice(1)} Tier Member
          </p>
        )}
      </div>

      {/* Credit Limit Card */}
      <div className="card bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground font-medium">Credit Available</p>
            <p className="text-3xl font-bold text-secondary mt-1">
              ${store.credit_available.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <CreditCard className="text-primary opacity-20" size={48} />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Credit Used</span>
            <span className="font-medium">${store.credit_used.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={`${creditColor} h-2 rounded-full transition-all`}
              style={{ width: `${Math.min(creditPercentage, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{creditPercentage.toFixed(1)}% used</span>
            <span>Limit: ${store.credit_limit.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Request Credit Increase */}
        <div className="mt-4 pt-4 border-t border-primary/10">
          {pendingRequest ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock size={16} className="text-primary" />
              Credit increase to ${pendingRequest.balance_after.toLocaleString()} is pending admin review.
            </div>
          ) : showRequestForm ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Requested Credit Limit ($)</label>
                <input
                  type="number"
                  min={store.credit_limit + 1}
                  step="0.01"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  placeholder={`Higher than $${store.credit_limit.toLocaleString()}`}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="e.g. Increasing order volume"
                  className="input w-full"
                />
              </div>
              {requestError && <p className="text-xs text-destructive">{requestError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSubmitCreditRequest}
                  disabled={submittingRequest}
                  className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
                >
                  {submittingRequest ? "Submitting..." : "Submit Request"}
                </button>
                <button
                  onClick={() => { setShowRequestForm(false); setRequestError(null) }}
                  className="btn-ghost text-sm px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowRequestForm(true)}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Request Credit Increase
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon
          return (
            <div key={idx} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                  <p className={`text-2xl font-bold mt-2 ${stat.color}`}>{stat.value}</p>
                  {(stat as any).subtext && (
                    <p className="text-xs text-muted-foreground mt-1">{(stat as any).subtext}</p>
                  )}
                </div>
                <Icon className={`${stat.color} opacity-20`} size={40} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold text-secondary mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/retailer/catalog" className="btn-primary w-full text-center">
            Browse Catalog
          </Link>
          <Link href="/retailer/orders" className="btn-secondary w-full text-center">
            View All Orders
          </Link>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-secondary">Recent Orders</h2>
          <Link href="/retailer/orders" className="text-primary font-medium text-sm hover:underline">
            View All
          </Link>
        </div>

        {dashboardData.recent_orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="mx-auto mb-2 opacity-50" size={48} />
            <p>No recent orders</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold">Order ID</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Items</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.recent_orders.map((order) => (
                  <tr key={order.order_number} className="border-b border-border hover:bg-muted">
                    <td className="px-4 py-3 text-sm font-medium text-primary">#{order.order_number}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(order.order_date)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{order.total_items} items</td>
                    <td className="px-4 py-3 text-sm font-bold">${order.total_amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`status-badge ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Unpaid Invoices */}
      {dashboardData.unpaid_invoices.length > 0 && (
        <div className="card border-l-4 border-l-red-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-secondary">Unpaid Invoices</h2>
            <AlertCircle className="text-red-500" size={24} />
          </div>
          <div className="space-y-3">
            {dashboardData.unpaid_invoices.map((invoice) => (
              <div key={invoice.invoice_number} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium text-secondary">Invoice #{invoice.invoice_number}</p>
                  <p className="text-sm text-muted-foreground">Due: {formatDate(invoice.due_date)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-600">${invoice.amount_due.toFixed(2)}</p>
                  {invoice.days_overdue > 0 && (
                    <p className="text-xs text-red-500">{invoice.days_overdue} days overdue</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low Stock Alerts */}
      {dashboardData.low_stock_products.length > 0 && (
        <div className="card border-l-4 border-l-yellow-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-secondary">Low Stock Alerts</h2>
            <AlertCircle className="text-yellow-500" size={24} />
          </div>
          <div className="space-y-3">
            {dashboardData.low_stock_products.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-secondary">{product.name}</p>
                  <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-yellow-600">{product.stock_quantity} units</p>
                  <p className="text-xs text-muted-foreground">Min: {product.low_stock_threshold}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
