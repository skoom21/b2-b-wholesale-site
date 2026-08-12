"use client"

import { useEffect, useState } from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { TrendingUp, Users, Package, DollarSign, AlertCircle } from "lucide-react"
import { fetchAdminDashboardData } from "@/lib/api-client"

export default function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true)
        const data = await fetchAdminDashboardData()
        setDashboardData(data)
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
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

  if (!dashboardData) return null

  const { stats, recent_orders, low_stock_products, pending_stores } = dashboardData

  const COLORS = ["#0f766e", "#6366f1", "#d97706", "#e11d48", "#0ea5e9"]

  const dashStats = [
    { 
      label: "Total Revenue", 
      value: `$${stats.revenue.total.toFixed(2)}`, 
      change: `$${stats.revenue.monthly.toFixed(2)} this month`, 
      icon: DollarSign 
    },
    { 
      label: "Total Orders", 
      value: stats.orders.total.toString(), 
      change: `${stats.orders.pending} pending`, 
      icon: TrendingUp 
    },
    { 
      label: "Active Stores", 
      value: stats.stores.active.toString(), 
      change: `${stats.stores.pending} pending approval`, 
      icon: Users 
    },
    { 
      label: "Products in Stock", 
      value: stats.products.active.toString(), 
      change: `${stats.products.out_of_stock} out of stock`, 
      icon: Package 
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-secondary">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of platform operations and sales metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashStats.map((stat, idx) => {
          const Icon = stat.icon
          return (
            <div key={idx} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold text-secondary mt-2">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                </div>
                <Icon className="text-primary opacity-20" size={40} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Tier Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Tiers */}
        <div className="card">
          <h2 className="text-xl font-bold text-secondary mb-6">Stores by Tier</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Gold Tier</span>
              <span className="text-lg font-bold text-yellow-600">{stats.stores.tiers.gold}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Silver Tier</span>
              <span className="text-lg font-bold text-muted-foreground/70">{stats.stores.tiers.silver}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Standard Tier</span>
              <span className="text-lg font-bold text-muted-foreground">{stats.stores.tiers.standard}</span>
            </div>
          </div>
        </div>

        {/* Inventory Alerts */}
        <div className="card">
          <h2 className="text-xl font-bold text-secondary mb-6">Inventory Alerts</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Low Stock Items</span>
              <span className="text-lg font-bold text-orange-600">{stats.products.low_stock}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Out of Stock</span>
              <span className="text-lg font-bold text-red-600">{stats.products.out_of_stock}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overdue Invoices</span>
              <span className="text-lg font-bold text-red-600">{stats.invoices.overdue_count}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <h2 className="text-xl font-bold text-secondary mb-6">Recent Orders</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold">Order #</th>
                <th className="px-4 py-3 text-left text-sm font-bold">Store</th>
                <th className="px-4 py-3 text-left text-sm font-bold">Date</th>
                <th className="px-4 py-3 text-left text-sm font-bold">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent_orders && recent_orders.length > 0 ? (
                recent_orders.map((order: any) => (
                  <tr key={order.id} className="border-b border-border hover:bg-muted">
                    <td className="px-4 py-3 text-sm font-medium text-primary">{order.order_number}</td>
                    <td className="px-4 py-3 text-sm">{order.stores?.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(order.order_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold">${parseFloat(order.total_amount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`status-badge ${
                        order.status === 'delivered' ? 'status-green' : 
                        order.status === 'cancelled' ? 'status-red' : 
                        'status-yellow'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No recent orders
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Stock Products */}
      {low_stock_products && low_stock_products.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-secondary mb-6">Low Stock Products</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold">SKU</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Product</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Stock</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Threshold</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {low_stock_products.slice(0, 10).map((product: any) => (
                  <tr key={product.id} className="border-b border-border hover:bg-muted">
                    <td className="px-4 py-3 text-sm font-medium text-primary">{product.sku}</td>
                    <td className="px-4 py-3 text-sm">{product.name}</td>
                    <td className="px-4 py-3 text-sm font-bold text-red-600">{product.stock_quantity}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{product.low_stock_threshold}</td>
                    <td className="px-4 py-3">
                      <span className={`status-badge ${
                        product.stock_status === 'out_of_stock' ? 'status-red' : 'status-yellow'
                      }`}>
                        {product.stock_status === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Stores */}
      {pending_stores && pending_stores.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-secondary mb-6">Pending Store Approvals</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold">Store Name</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">City</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Applied</th>
                </tr>
              </thead>
              <tbody>
                {pending_stores.map((store: any) => (
                  <tr key={store.id} className="border-b border-border hover:bg-muted">
                    <td className="px-4 py-3 text-sm font-medium">{store.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{store.email}</td>
                    <td className="px-4 py-3 text-sm">{store.city}</td>
                    <td className="px-4 py-3 text-sm">{store.store_type}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(store.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
