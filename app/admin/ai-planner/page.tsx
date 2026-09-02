"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, BrainCircuit, PackagePlus, Sparkles, TrendingDown, TrendingUp } from "lucide-react"

type Advice = {
  generated_at: string
  summary: string
  metrics: { stockout_risks: number; overstock_risks: number; suggested_reorder_units: number }
  recommendations: Array<{
    product_id: string; name: string; sku: string; stock_quantity: number; units_sold_180d: number
    revenue_180d: number; forecast_30d: number; reorder_point: number; suggested_reorder: number
    days_of_cover: number | null; trend_pct: number; classification: "A" | "B" | "C"
    risk: "stockout" | "overstock" | "dead_stock" | "healthy"; confidence: "high" | "medium" | "low"
  }>
}

const riskStyle: Record<string, string> = {
  stockout: "bg-rose-50 text-rose-700 border-rose-200",
  overstock: "bg-amber-50 text-amber-700 border-amber-200",
  dead_stock: "bg-slate-100 text-slate-700 border-slate-200",
  healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
}

export default function AIPlannerPage() {
  const [data, setData] = useState<Advice | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/ai/inventory-advisor")
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error?.message || "Analysis failed")
        setData(body.data)
      })
      .catch(err => setError(err.message))
  }, [])

  if (error) return <div className="card text-destructive">Unable to prepare inventory advice: {error}</div>
  if (!data) return <div className="h-96 grid place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary"><Sparkles size={14} /> Predictive inventory intelligence</div>
        <h1 className="mt-3 text-3xl font-bold text-secondary">AI Inventory Planner</h1>
        <p className="mt-1 text-muted-foreground">A rolling demand forecast using the last 180 days of this brand’s sales.</p>
      </div>

      <div className="card border-primary/20 bg-gradient-to-br from-primary/10 to-indigo-500/5">
        <div className="flex gap-4"><div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0"><BrainCircuit size={23} /></div><div><h2 className="font-bold text-lg">What needs attention</h2><p className="mt-1 text-muted-foreground">{data.summary}</p><p className="mt-3 text-xs text-muted-foreground">Forecasts use weighted recent sales velocity, safety stock, reorder lead time and ABC revenue classification. Recommendations with limited sales history are marked low confidence.</p></div></div>
      </div>

      <div className="grid sm:grid-cols-3 gap-5">
        <div className="card"><AlertTriangle className="text-rose-600" /><p className="mt-4 text-3xl font-black">{data.metrics.stockout_risks}</p><p className="text-sm text-muted-foreground">stockout risks</p></div>
        <div className="card"><TrendingDown className="text-amber-600" /><p className="mt-4 text-3xl font-black">{data.metrics.overstock_risks}</p><p className="text-sm text-muted-foreground">slow or excess stock risks</p></div>
        <div className="card"><PackagePlus className="text-primary" /><p className="mt-4 text-3xl font-black">{data.metrics.suggested_reorder_units}</p><p className="text-sm text-muted-foreground">suggested units to reorder</p></div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="p-5 border-b"><h2 className="text-xl font-bold">Product recommendations</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr><th className="px-5 py-3 text-left">Product</th><th className="px-4 py-3 text-left">Class</th><th className="px-4 py-3 text-right">In stock</th><th className="px-4 py-3 text-right">30-day forecast</th><th className="px-4 py-3 text-right">Days cover</th><th className="px-4 py-3 text-right">Reorder</th><th className="px-4 py-3 text-left">Risk</th><th className="px-4 py-3 text-left">Confidence</th></tr></thead>
            <tbody>
              {data.recommendations.map(item => (
                <tr key={item.product_id} className="border-t hover:bg-muted/40">
                  <td className="px-5 py-4"><p className="font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">{item.sku} · {item.units_sold_180d} sold in 180d</p></td>
                  <td className="px-4 py-4"><span className="font-black text-primary">{item.classification}</span></td>
                  <td className="px-4 py-4 text-right">{item.stock_quantity}</td>
                  <td className="px-4 py-4 text-right">{item.forecast_30d}<span className={`ml-2 inline-flex items-center ${item.trend_pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{item.trend_pct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{Math.abs(item.trend_pct)}%</span></td>
                  <td className="px-4 py-4 text-right">{item.days_of_cover ?? "—"}</td>
                  <td className="px-4 py-4 text-right font-bold">{item.suggested_reorder || "—"}</td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${riskStyle[item.risk]}`}>{item.risk.replace("_", " ")}</span></td>
                  <td className="px-4 py-4 capitalize text-sm">{item.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
