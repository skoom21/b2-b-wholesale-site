"use client"

import { useState, useEffect } from "react"
import { Printer, AlertCircle } from "lucide-react"
import { fetchOrders, apiClient } from "@/lib/api-client"

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("all")
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    loadOrders()
  }, [statusFilter])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const params = statusFilter !== "all" ? { status: statusFilter } : {}
      const data = await fetchOrders(params)
      setOrders(data.orders)
    } catch (err: any) {
      setError(err.message || 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const loadOrderDetails = async (orderId: string) => {
    try {
      setLoadingDetails(true)
      const details = await apiClient(`/api/orders/${orderId}`)
      setOrderDetails(details)
    } catch (err: any) {
      console.error('Failed to load order details:', err)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleExpandOrder = (orderId: string) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null)
      setOrderDetails(null)
    } else {
      setExpandedOrder(orderId)
      loadOrderDetails(orderId)
    }
  }

  const statuses = ["all", "pending", "processing", "confirmed", "out_for_delivery", "delivered", "cancelled"]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "status-green"
      case "out_for_delivery":
      case "confirmed":
        return "status-yellow"
      case "processing":
      case "pending":
        return "status-yellow"
      case "cancelled":
        return "status-red"
      default:
        return "status-gray"
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      delivered: "Delivered",
      out_for_delivery: "Out for Delivery",
      confirmed: "Confirmed",
      processing: "Processing",
      pending: "Pending",
      cancelled: "Cancelled",
    }
    return labels[status] || status
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle size={20} />
          <p>Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-secondary">Order Fulfillment</h1>
        <p className="text-muted-foreground">Central queue of all incoming orders</p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <label className="block text-sm font-bold text-secondary mb-3">Filter by Status</label>
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === status ? "bg-primary text-primary-foreground" : "bg-muted text-secondary hover:bg-muted"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-sm font-bold">Order #</th>
              <th className="px-4 py-3 text-left text-sm font-bold">Store</th>
              <th className="px-4 py-3 text-left text-sm font-bold">Date</th>
              <th className="px-4 py-3 text-left text-sm font-bold">Items</th>
              <th className="px-4 py-3 text-left text-sm font-bold">Total</th>
              <th className="px-4 py-3 text-left text-sm font-bold">Status</th>
              <th className="px-4 py-3 text-left text-sm font-bold">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.length > 0 ? (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-border hover:bg-muted">
                  <td className="px-4 py-3 text-sm font-medium text-primary">{order.order_number}</td>
                  <td className="px-4 py-3 text-sm">{order.store_name || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(order.order_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm">{order.total_items}</td>
                  <td className="px-4 py-3 text-sm font-bold">${parseFloat(order.total_amount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleExpandOrder(order.id)}
                      className="btn-ghost text-xs flex items-center gap-1"
                    >
                      <Printer size={14} />
                      {expandedOrder === order.id ? "Hide" : "Details"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No orders found for the selected filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Expanded Order Details */}
      {expandedOrder && (
        <div className="card bg-muted/50">
          {loadingDetails ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading order details...</p>
            </div>
          ) : orderDetails ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-secondary">Order Details - {orderDetails.order_number}</h3>
                <button onClick={() => window.print()} className="btn-primary inline-flex items-center gap-2">
                  <Printer size={16} />
                  Print
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-6 pb-4 border-b border-border">
                  <div>
                    <p className="text-xs font-bold text-secondary">STORE</p>
                    <p className="font-bold">{orderDetails.store_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-secondary">ORDER #</p>
                    <p className="font-bold text-primary">{orderDetails.order_number}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-secondary">DATE</p>
                    <p>{new Date(orderDetails.order_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-secondary">STATUS</p>
                    <span className={`status-badge ${getStatusColor(orderDetails.status)}`}>
                      {getStatusLabel(orderDetails.status)}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-secondary mb-3">ITEMS</p>
                  <div className="space-y-2">
                    {orderDetails.items && orderDetails.items.length > 0 ? (
                      orderDetails.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between items-center text-sm pb-2 border-b border-border">
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">SKU: {item.product_sku}</p>
                          </div>
                          <div className="text-right">
                            <p>Qty: {item.quantity}</p>
                            <p className="text-xs text-muted-foreground">${parseFloat(item.unit_price).toFixed(2)} each</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No items found</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between font-bold text-lg">
                    <span>TOTAL</span>
                    <span>${parseFloat(orderDetails.total_amount).toFixed(2)}</span>
                  </div>
                </div>

                {orderDetails.notes && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs font-bold text-secondary mb-2">NOTES</p>
                    <p className="text-sm text-foreground">{orderDetails.notes}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">Failed to load order details</p>
          )}
        </div>
      )}
    </div>
  )
}
