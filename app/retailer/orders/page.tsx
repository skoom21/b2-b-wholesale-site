"use client"

import { useState, useEffect } from "react"
import { fetchOrders, fetchOrder, ApiError } from "@/lib/api-client"
import { useUser } from "@/hooks/use-user"
import { Loader2, AlertCircle, Package } from "lucide-react"

export default function OrdersPage() {
  const { store, isLoading: userLoading } = useUser()
  const [orders, setOrders] = useState<any[]>([])
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [orderDetails, setOrderDetails] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetails, setIsLoadingDetails] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  useEffect(() => {
    async function loadOrders() {
      // Wait for user context and require store
      if (userLoading || !store) {
        if (!userLoading && !store) {
          setIsLoading(false)
          setError("No store found for your account")
        }
        return
      }

      try {
        setIsLoading(true)
        const response = await fetchOrders({ status: statusFilter || undefined })
        setOrders(Array.isArray(response?.orders) ? response.orders : [])
        setError(null)
      } catch (err) {
        console.error("Failed to load orders:", err)
        setError(err instanceof ApiError ? err.message : "Failed to load orders")
      } finally {
        setIsLoading(false)
      }
    }

    loadOrders()
  }, [userLoading, store, statusFilter])

  const handleExpandOrder = async (orderId: string) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null)
      return
    }

    setExpandedOrder(orderId)

    // Fetch order details if not already loaded
    if (!orderDetails[orderId]) {
      try {
        setIsLoadingDetails(orderId)
        const details = await fetchOrder(orderId)
        setOrderDetails({ ...orderDetails, [orderId]: details })
      } catch (err) {
        console.error("Failed to load order details:", err)
      } finally {
        setIsLoadingDetails(null)
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card border-l-4 border-l-red-500">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-red-500" size={24} />
          <div>
            <p className="font-semibold text-secondary">Error Loading Orders</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    )
  }

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
      out_for_delivery: "Out for Delivery",
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

  const statuses = ["pending", "confirmed", "processing", "out_for_delivery", "delivered", "cancelled"]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-secondary">Order History</h1>
        <p className="text-muted-foreground">Track and manage all your orders</p>
      </div>

      {/* Status Filter */}
      <div className="bg-card border border-border rounded-lg p-4">
        <label className="block text-sm font-bold text-secondary mb-3">Filter by Status</label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === null ? "bg-primary text-primary-foreground" : "bg-muted text-secondary hover:bg-muted"
            }`}
          >
            All
          </button>
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === status ? "bg-primary text-primary-foreground" : "bg-muted text-secondary hover:bg-muted"
              }`}
            >
              {getStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <Package className="mx-auto text-muted-foreground/70 mb-3" size={48} />
          <p className="text-muted-foreground">
            {statusFilter ? `No ${getStatusLabel(statusFilter).toLowerCase()} orders found` : "No orders yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const details = orderDetails[order.id]
            const isExpanded = expandedOrder === order.id

            return (
              <div key={order.id} className="card">
                <div
                  onClick={() => handleExpandOrder(order.id)}
                  className="cursor-pointer flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className="font-bold text-secondary">Order #{order.order_number}</h3>
                      <span className={`status-badge ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-muted-foreground">
                      <div>
                        <p className="text-xs font-bold text-secondary">Date</p>
                        <p>{formatDate(order.order_date)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-secondary">Items</p>
                        <p>{order.total_items}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-secondary">Total</p>
                        <p className="font-bold text-secondary">${order.total_amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-secondary">Action</p>
                        <p className="text-primary font-medium text-xs">
                          {isExpanded ? "Hide Details" : "View Details"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-border">
                    {isLoadingDetails === order.id ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="animate-spin text-primary" size={32} />
                      </div>
                    ) : details ? (
                      <>
                        <h4 className="font-bold text-secondary mb-4">Items in Order</h4>
                        <div className="space-y-3">
                          {details.items.map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center text-sm">
                              <div>
                                <span className="text-foreground font-medium">{item.product_name}</span>
                                <p className="text-xs text-muted-foreground">SKU: {item.product_sku}</p>
                              </div>
                              <div className="text-right">
                                <span className="font-medium">
                                  {item.quantity} × ${item.unit_price.toFixed(2)}
                                </span>
                                <p className="text-xs text-muted-foreground">${item.subtotal.toFixed(2)}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-medium">${details.subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Tax</span>
                            <span className="font-medium">${details.tax_amount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-lg">
                            <span className="text-secondary">Order Total</span>
                            <span className="text-primary">${details.total_amount.toFixed(2)}</span>
                          </div>
                        </div>

                        {details.notes && (
                          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs font-bold text-secondary mb-1">Notes</p>
                            <p className="text-sm text-muted-foreground">{details.notes}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">Failed to load order details</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
