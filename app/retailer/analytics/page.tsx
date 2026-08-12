"use client"

import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { AlertCircle, Package, TrendingUp, DollarSign } from "lucide-react"
import { fetchRetailerReports } from "@/lib/api-client"

export default function RetailerAnalyticsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchRetailerReports>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const result = await fetchRetailerReports()
        setData(result)
        setError(null)
      } catch (err: any) {
        setError(err.message || "Failed to load analytics")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading your analytics...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle size={20} />
          <p>Error: {error || "No data available"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-secondary">Your Buying Analytics</h1>
        <p className="text-muted-foreground">Track your ordering history and spending patterns</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <p className="text-sm text-muted-foreground font-medium">Total Spend (6mo)</p>
          <p className="text-3xl font-bold text-primary mt-2">
            ${data.total_spend_6mo.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <DollarSign size={12} /> Across {data.total_orders_6mo} order{data.total_orders_6mo === 1 ? "" : "s"}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-muted-foreground font-medium">Average Order Value</p>
          <p className="text-3xl font-bold text-primary mt-2">
            ${data.avg_order_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <TrendingUp size={12} /> Last 6 months
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-muted-foreground font-medium">Most Purchased Item</p>
          <p className="text-3xl font-bold text-primary mt-2 truncate">{data.most_purchased[0]?.name || "—"}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Package size={12} /> {data.most_purchased[0] ? `${data.most_purchased[0].quantity} units bought` : "No orders yet"}
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-secondary mb-6">Spending Trend (Last 6 Months)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.monthly_spend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="month" stroke="#78716c" />
            <YAxis stroke="#78716c" />
            <Tooltip />
            <Line type="monotone" dataKey="spend" stroke="#0f766e" strokeWidth={2} name="Spend ($)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-secondary mb-6">Your Most Purchased Products</h2>
        {data.most_purchased.length === 0 ? (
          <p className="text-sm text-muted-foreground">No purchase history yet — place an order to see your buying patterns here.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.most_purchased.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis dataKey="name" stroke="#78716c" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={70} />
                <YAxis stroke="#78716c" />
                <Tooltip />
                <Bar dataKey="quantity" fill="#0f766e" name="Units Purchased" />
              </BarChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto mt-6">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold">Product</th>
                    <th className="px-4 py-3 text-left text-sm font-bold">Units Bought</th>
                    <th className="px-4 py-3 text-left text-sm font-bold">Total Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {data.most_purchased.map((item) => (
                    <tr key={item.product_id} className="border-b border-border hover:bg-muted">
                      <td className="px-4 py-3 text-sm font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-sm">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm">${item.spend.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
