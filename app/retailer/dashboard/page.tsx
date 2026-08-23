"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { TrendingUp, ShoppingCart, AlertCircle, CreditCard, DollarSign, Package, Repeat } from "lucide-react"
import { fetchDashboardData, recordStorePayment, fetchPaymentModelRequests, submitPaymentModelRequest, ApiError, type PaymentModelRequest } from "@/lib/api-client"
import { useUser } from "@/hooks/use-user"

export default function RetailerDashboard() {
  const { store: userStore } = useUser()
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentLogged, setPaymentLogged] = useState(false)

  const [pendingModelRequest, setPendingModelRequest] = useState<PaymentModelRequest | null>(null)
  const [showModelRequestForm, setShowModelRequestForm] = useState(false)
  const [requestedModel, setRequestedModel] = useState("credit")
  const [requestedFrequency, setRequestedFrequency] = useState("weekly")
  const [modelRequestReason, setModelRequestReason] = useState("")
  const [submittingModelRequest, setSubmittingModelRequest] = useState(false)
  const [modelRequestError, setModelRequestError] = useState<string | null>(null)

  useEffect(() => {
    const loadModelRequests = async () => {
      try {
        const data = await fetchPaymentModelRequests()
        const pending = (data.requests || []).find(r => r.status === 'pending')
        setPendingModelRequest(pending || null)
      } catch (err) {
        console.error('[Dashboard] Failed to load payment model requests:', err)
      }
    }
    loadModelRequests()
  }, [])

  const handleSubmitModelRequest = async () => {
    if (requestedModel === dashboardData?.store?.payment_model) {
      setModelRequestError(`You're already on the ${requestedModel} model`)
      return
    }
    try {
      setSubmittingModelRequest(true)
      setModelRequestError(null)
      const result: any = await submitPaymentModelRequest({
        requested_model: requestedModel as any,
        requested_billing_frequency: requestedModel === 'subscription' ? requestedFrequency as any : undefined,
        reason: modelRequestReason || undefined,
      })
      setPendingModelRequest(result.request)
      setShowModelRequestForm(false)
      setModelRequestReason("")
    } catch (err: any) {
      setModelRequestError(err.message || "Failed to submit request")
    } finally {
      setSubmittingModelRequest(false)
    }
  }

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

    loadDashboard()
  }, [])

  const handleLogPayment = async () => {
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) {
      setPaymentError("Enter a valid amount")
      return
    }
    try {
      setSubmittingPayment(true)
      setPaymentError(null)
      const result = await recordStorePayment(dashboardData.store.id, { amount })
      setDashboardData((prev: any) => ({ ...prev, store: { ...prev.store, credit_used: result.credit_used } }))
      setShowPaymentForm(false)
      setPaymentAmount("")
      setPaymentLogged(true)
      setTimeout(() => setPaymentLogged(false), 4000)
    } catch (err: any) {
      setPaymentError(err.message || "Failed to log payment")
    } finally {
      setSubmittingPayment(false)
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

      {/* Amount Owed Card */}
      <div className="card bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground font-medium">Amount You Owe</p>
            <p className="text-3xl font-bold text-secondary mt-1">
              ${store.credit_used.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Builds up as your orders are confirmed — no limit on ordering.</p>
          </div>
          <CreditCard className="text-primary opacity-20" size={48} />
        </div>

        {/* Log a payment */}
        <div className="mt-4 pt-4 border-t border-primary/10">
          {paymentLogged && (
            <p className="text-sm text-primary font-medium mb-2">Payment logged — thanks!</p>
          )}
          {showPaymentForm ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Amount Paid ($)</label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="How much did you pay?"
                  className="input w-full"
                />
              </div>
              {paymentError && <p className="text-xs text-destructive">{paymentError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleLogPayment}
                  disabled={submittingPayment}
                  className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
                >
                  {submittingPayment ? "Saving..." : "Save Payment"}
                </button>
                <button
                  onClick={() => { setShowPaymentForm(false); setPaymentError(null) }}
                  className="btn-ghost text-sm px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPaymentForm(true)}
              className="text-sm font-semibold text-primary hover:underline"
            >
              I've Made a Payment
            </button>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Paid in person instead? Your account manager can record that on their end too.
          </p>
        </div>
      </div>

      {/* Payment Model */}
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Repeat className="text-primary" size={18} />
          <h2 className="text-lg font-bold text-secondary">Your Payment Model</h2>
        </div>
        <p className="text-sm font-semibold text-secondary capitalize">
          {(store.payment_model || 'credit').replace('_', ' ')}
          {store.billing_frequency && ` — billed ${store.billing_frequency}`}
        </p>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          {store.payment_model === 'per_order'
            ? 'You pay for each order up front.'
            : store.payment_model === 'subscription'
            ? `Dues are consolidated into one invoice every ${store.billing_frequency || 'period'}${store.next_billing_date ? `, next on ${new Date(store.next_billing_date).toLocaleDateString('en-CA')}` : ''}.`
            : 'Your dues build up as you order, and you pay them down whenever suits you.'}
        </p>

        {pendingModelRequest ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Request to switch to <span className="font-medium capitalize">{pendingModelRequest.requested_model.replace('_', ' ')}</span> is pending review.
          </p>
        ) : showModelRequestForm ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Requested Model</label>
              <select value={requestedModel} onChange={(e) => setRequestedModel(e.target.value)} className="input w-full">
                <option value="credit">Credit (net terms)</option>
                <option value="per_order">Per Order (pay up front)</option>
                <option value="subscription">Subscription (consolidated billing)</option>
              </select>
            </div>
            {requestedModel === 'subscription' && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Billing Frequency</label>
                <select value={requestedFrequency} onChange={(e) => setRequestedFrequency(e.target.value)} className="input w-full">
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Reason (optional)</label>
              <input
                type="text"
                value={modelRequestReason}
                onChange={(e) => setModelRequestReason(e.target.value)}
                placeholder="e.g. Would rather pay per order"
                className="input w-full"
              />
            </div>
            {modelRequestError && <p className="text-xs text-destructive">{modelRequestError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSubmitModelRequest}
                disabled={submittingModelRequest}
                className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
              >
                {submittingModelRequest ? "Submitting..." : "Submit Request"}
              </button>
              <button
                onClick={() => { setShowModelRequestForm(false); setModelRequestError(null) }}
                className="btn-ghost text-sm px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowModelRequestForm(true)}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Request a different payment model
          </button>
        )}
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
