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
} from "recharts"
import { Download, Lightbulb, TrendingUp, TrendingDown, AlertCircle } from "lucide-react"
import { fetchReports } from "@/lib/api-client"

const STORE_TYPE_LABELS: Record<string, string> = {
  grocery_store: "Grocery",
  restaurant: "Restaurant",
  distributor: "Distributor",
  other: "Other",
}

function toCsvValue(value: string | number) {
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export default function ReportsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchReports>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const result = await fetchReports()
        setData(result)
        setError(null)
      } catch (err: any) {
        setError(err.message || "Failed to load reports")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleExport = () => {
    if (!data) return

    const lines: string[] = []
    lines.push("Teetoz Financial Report")
    lines.push(`Generated,${new Date().toLocaleString()}`)
    lines.push("")

    lines.push("Monthly Revenue")
    lines.push("Month,Revenue")
    data.monthly_revenue.forEach(row => lines.push(`${toCsvValue(row.month)},${row.revenue}`))
    lines.push("")

    lines.push(`Top Sellers (${data.current_month_label})`)
    lines.push("Product,SKU,Units Sold,Revenue")
    data.top_sellers.forEach(row =>
      lines.push(`${toCsvValue(row.name)},${toCsvValue(row.sku)},${row.quantity},${row.revenue.toFixed(2)}`)
    )
    lines.push("")

    lines.push(`Slowest Sellers (${data.current_month_label})`)
    lines.push("Product,SKU,Units Sold,Revenue")
    data.bottom_sellers.forEach(row =>
      lines.push(`${toCsvValue(row.name)},${toCsvValue(row.sku)},${row.quantity},${row.revenue.toFixed(2)}`)
    )
    lines.push("")

    lines.push("Insights")
    data.insights.forEach(insight => lines.push(toCsvValue(insight)))

    const csv = lines.join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `teetoz-report-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading reports...</p>
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

  const revenueByTypeData = Object.entries(data.revenue_by_type).map(([type, revenue]) => ({
    type: STORE_TYPE_LABELS[type] || type,
    revenue: Math.round(revenue * 100) / 100,
  }))

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Financial Reports</h1>
          <p className="text-muted-foreground">Analytics and insights on sales performance</p>
        </div>
        <button onClick={handleExport} className="btn-primary inline-flex items-center gap-2">
          <Download size={18} />
          Export Report
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <p className="text-sm text-muted-foreground font-medium">This Month's Revenue</p>
          <p className="text-3xl font-bold text-primary mt-2">${data.this_month_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          {data.revenue_change_pct !== null ? (
            <p className={`text-xs mt-1 flex items-center gap-1 ${data.revenue_change_pct >= 0 ? "text-green-600" : "text-destructive"}`}>
              {data.revenue_change_pct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {data.revenue_change_pct >= 0 ? "+" : ""}{data.revenue_change_pct}% from last month
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">No prior month data yet</p>
          )}
        </div>
        <div className="card">
          <p className="text-sm text-muted-foreground font-medium">Last Month's Revenue</p>
          <p className="text-3xl font-bold text-primary mt-2">${data.last_month_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground mt-1">{data.current_month_label} vs. previous month</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted-foreground font-medium">Best Seller This Month</p>
          <p className="text-3xl font-bold text-primary mt-2 truncate">{data.top_sellers[0]?.name || "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.top_sellers[0] ? `${data.top_sellers[0].quantity} units sold` : "No sales recorded yet"}
          </p>
        </div>
      </div>

      {/* AI-style Insights */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <Lightbulb className="text-primary" size={20} />
          <h2 className="text-xl font-bold text-secondary">Suggestions to Improve</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-4 mb-4">
          Generated from your order and inventory data (not a live AI call).
        </p>
        <ul className="space-y-3">
          {data.insights.map((insight, idx) => (
            <li key={idx} className="flex gap-3 items-start text-sm">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <span className="text-foreground">{insight}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Revenue Trend */}
      <div className="card">
        <h2 className="text-xl font-bold text-secondary mb-6">Revenue Trend (Last 6 Months)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.monthly_revenue}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="month" stroke="#78716c" />
            <YAxis stroke="#78716c" />
            <Tooltip />
            <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} name="Revenue ($)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue by Store Type */}
      <div className="card">
        <h2 className="text-xl font-bold text-secondary mb-6">Revenue by Store Type ({data.current_month_label})</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueByTypeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="type" stroke="#78716c" />
            <YAxis stroke="#78716c" />
            <Tooltip />
            <Legend />
            <Bar dataKey="revenue" fill="#0f766e" name="Revenue ($)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top / Bottom Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold text-secondary mb-6">Top Sellers ({data.current_month_label})</h2>
          {data.top_sellers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales recorded this month yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold">Product</th>
                    <th className="px-4 py-3 text-left text-sm font-bold">Units</th>
                    <th className="px-4 py-3 text-left text-sm font-bold">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_sellers.map((item) => (
                    <tr key={item.product_id} className="border-b border-border hover:bg-muted">
                      <td className="px-4 py-3 text-sm font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-sm">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm">${item.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-secondary mb-6">Slowest Sellers ({data.current_month_label})</h2>
          {data.bottom_sellers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales recorded this month yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold">Product</th>
                    <th className="px-4 py-3 text-left text-sm font-bold">Units</th>
                    <th className="px-4 py-3 text-left text-sm font-bold">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bottom_sellers.map((item) => (
                    <tr key={item.product_id} className="border-b border-border hover:bg-muted">
                      <td className="px-4 py-3 text-sm font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-sm">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm">${item.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {data.no_sales_this_month.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-secondary mb-4">No Sales This Month</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {data.no_sales_this_month.length} active product{data.no_sales_this_month.length > 1 ? "s" : ""} with zero orders in {data.current_month_label}.
          </p>
          <div className="flex flex-wrap gap-2">
            {data.no_sales_this_month.map((p) => (
              <span key={p.id} className="status-badge status-gray">{p.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
