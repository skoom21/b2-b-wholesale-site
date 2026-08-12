"use client"

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
import { Download } from "lucide-react"

export default function ReportsPage() {
  const inventoryData = [
    { product: "Paneer", velocity: 95, movement: "Fast" },
    { product: "Samosa", velocity: 78, movement: "Medium" },
    { product: "Biryani Rice", velocity: 88, movement: "Fast" },
    { product: "Naan", velocity: 100, movement: "Very Fast" },
    { product: "Chai Mix", velocity: 65, movement: "Medium" },
    { product: "Mango Lassi", velocity: 72, movement: "Medium" },
  ]

  const revenueData = [
    { week: "Week 1", restaurant: 5200, grocery: 4100, distributor: 2300 },
    { week: "Week 2", restaurant: 6100, grocery: 4900, distributor: 2800 },
    { week: "Week 3", restaurant: 5800, grocery: 5200, distributor: 3100 },
    { week: "Week 4", restaurant: 7200, grocery: 6100, distributor: 3800 },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Financial Reports</h1>
          <p className="text-muted-foreground">Analytics and insights on sales performance</p>
        </div>
        <button className="btn-primary inline-flex items-center gap-2">
          <Download size={18} />
          Export Report
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <p className="text-sm text-muted-foreground font-medium">Monthly Revenue</p>
          <p className="text-3xl font-bold text-primary mt-2">$165,500</p>
          <p className="text-xs text-green-600 mt-1">+12.5% from last month</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted-foreground font-medium">Average Order Value</p>
          <p className="text-3xl font-bold text-primary mt-2">$1,141</p>
          <p className="text-xs text-green-600 mt-1">+5.3% from last month</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted-foreground font-medium">Best Selling Category</p>
          <p className="text-3xl font-bold text-primary mt-2">Naan</p>
          <p className="text-xs text-muted-foreground mt-1">100% inventory velocity</p>
        </div>
      </div>

      {/* Revenue by Store Type */}
      <div className="card">
        <h2 className="text-xl font-bold text-secondary mb-6">Revenue by Store Type (Weekly)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="week" stroke="#78716c" />
            <YAxis stroke="#78716c" />
            <Tooltip />
            <Legend />
            <Bar dataKey="restaurant" fill="#0f766e" name="Restaurant" />
            <Bar dataKey="grocery" fill="#6366f1" name="Grocery" />
            <Bar dataKey="distributor" fill="#d97706" name="Distributor" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Inventory Velocity */}
      <div className="card">
        <h2 className="text-xl font-bold text-secondary mb-6">Inventory Velocity (Stock Movement)</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold">Product</th>
                <th className="px-4 py-3 text-left text-sm font-bold">Velocity Score</th>
                <th className="px-4 py-3 text-left text-sm font-bold">Movement</th>
              </tr>
            </thead>
            <tbody>
              {inventoryData.map((item, idx) => (
                <tr key={idx} className="border-b border-border hover:bg-muted">
                  <td className="px-4 py-3 text-sm font-medium">{item.product}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="w-24 bg-muted-foreground/30 rounded h-2">
                      <div className="bg-primary rounded h-2" style={{ width: `${item.velocity}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`status-badge ${
                        item.movement === "Very Fast"
                          ? "status-green"
                          : item.movement === "Fast"
                            ? "status-yellow"
                            : "status-red"
                      }`}
                    >
                      {item.movement}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Best Sellers */}
      <div className="card">
        <h2 className="text-xl font-bold text-secondary mb-6">Top 5 Best Sellers</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={[
              { rank: "#1", product: "Naan", orders: 145 },
              { rank: "#2", product: "Paneer", orders: 128 },
              { rank: "#3", product: "Biryani Rice", orders: 112 },
              { rank: "#4", product: "Samosa", orders: 98 },
              { rank: "#5", product: "Chai Mix", orders: 85 },
            ]}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="product" stroke="#78716c" />
            <YAxis stroke="#78716c" />
            <Tooltip />
            <Line type="monotone" dataKey="orders" stroke="#0f766e" strokeWidth={2} name="Order Count" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
