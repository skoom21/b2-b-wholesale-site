import { createServerSupabaseClient, requireAdmin } from "@/lib/api/auth"
import { apiError, apiSuccess } from "@/lib/api/response"

const DAY = 86_400_000

export async function GET() {
  try {
    const profile = await requireAdmin()
    const supabase = await createServerSupabaseClient()
    const since = new Date(Date.now() - 180 * DAY).toISOString()

    const [{ data: products, error: productError }, { data: items, error: itemError }] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, sku, stock_quantity, low_stock_threshold, base_price")
        .eq("brand_id", profile.brand_id)
        .eq("is_active", true),
      supabase
        .from("order_items")
        .select("product_id, quantity, subtotal, orders!inner(order_date, status, brand_id)")
        .eq("orders.brand_id", profile.brand_id)
        .neq("orders.status", "cancelled")
        .gte("orders.order_date", since),
    ])

    if (productError || itemError) {
      return apiError("Unable to analyze inventory", "DATABASE_ERROR", 500, productError || itemError)
    }

    const periods = [
      { days: 30, weight: 0.55 },
      { days: 60, weight: 0.30 },
      { days: 180, weight: 0.15 },
    ]
    const now = Date.now()
    const sales = new Map<string, { quantities: number[]; revenue: number; total: number }>()
    for (const product of products || []) sales.set(product.id, { quantities: [0, 0, 0], revenue: 0, total: 0 })

    for (const item of items || []) {
      const record = sales.get(item.product_id)
      const order = item.orders as any
      if (!record || !order?.order_date) continue
      const age = (now - new Date(order.order_date).getTime()) / DAY
      periods.forEach((period, index) => {
        if (age <= period.days) record.quantities[index] += Number(item.quantity || 0)
      })
      record.revenue += Number(item.subtotal || 0)
      record.total += Number(item.quantity || 0)
    }

    const revenueRank = [...sales.entries()].sort((a, b) => b[1].revenue - a[1].revenue)
    const totalRevenue = revenueRank.reduce((sum, [, value]) => sum + value.revenue, 0)
    const classifications = new Map<string, "A" | "B" | "C">()
    let cumulative = 0
    for (const [id, value] of revenueRank) {
      cumulative += value.revenue
      const share = totalRevenue ? cumulative / totalRevenue : 1
      classifications.set(id, share <= 0.8 ? "A" : share <= 0.95 ? "B" : "C")
    }

    const recommendations = (products || []).map(product => {
      const record = sales.get(product.id)!
      const weightedDailyDemand = periods.reduce(
        (sum, period, index) => sum + (record.quantities[index] / period.days) * period.weight,
        0
      )
      const forecast30 = Math.ceil(weightedDailyDemand * 30)
      const safetyStock = Math.ceil(weightedDailyDemand * 7)
      const reorderPoint = Math.ceil(weightedDailyDemand * 14) + safetyStock
      const reorderQuantity = Math.max(0, Math.ceil(weightedDailyDemand * 45) - product.stock_quantity)
      const daysOfCover = weightedDailyDemand > 0 ? Math.round(product.stock_quantity / weightedDailyDemand) : null
      const trend = record.quantities[1] > 0
        ? Math.round(((record.quantities[0] - record.quantities[1] / 2) / (record.quantities[1] / 2)) * 100)
        : record.quantities[0] > 0 ? 100 : 0
      const risk = product.stock_quantity <= reorderPoint
        ? "stockout"
        : daysOfCover !== null && daysOfCover > 90 ? "overstock"
        : record.total === 0 ? "dead_stock"
        : "healthy"
      const confidence = record.total >= 30 ? "high" : record.total >= 10 ? "medium" : "low"

      return {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        stock_quantity: product.stock_quantity,
        units_sold_180d: record.total,
        revenue_180d: Math.round(record.revenue * 100) / 100,
        forecast_30d: forecast30,
        reorder_point: reorderPoint,
        suggested_reorder: reorderQuantity,
        days_of_cover: daysOfCover,
        trend_pct: trend,
        classification: classifications.get(product.id) || "C",
        risk,
        confidence,
      }
    }).sort((a, b) => {
      const priority: Record<string, number> = { stockout: 0, dead_stock: 1, overstock: 2, healthy: 3 }
      return priority[a.risk] - priority[b.risk] || b.revenue_180d - a.revenue_180d
    })

    const stockoutCount = recommendations.filter(item => item.risk === "stockout").length
    const overstockCount = recommendations.filter(item => item.risk === "overstock" || item.risk === "dead_stock").length
    const suggestedUnits = recommendations.reduce((sum, item) => sum + item.suggested_reorder, 0)
    const summary = stockoutCount
      ? `${stockoutCount} product${stockoutCount === 1 ? "" : "s"} may run short. Prioritize A-class products with high-confidence forecasts first.`
      : overstockCount
        ? `Stock availability looks stable, but ${overstockCount} slow-moving product${overstockCount === 1 ? "" : "s"} may be tying up cash.`
        : "Inventory is balanced against recent demand. Keep monitoring changes in weekly sales velocity."

    return apiSuccess({
      generated_at: new Date().toISOString(),
      horizon_days: 30,
      summary,
      metrics: { stockout_risks: stockoutCount, overstock_risks: overstockCount, suggested_reorder_units: suggestedUnits },
      recommendations,
    })
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return apiError(error.message, error.message.includes("Forbidden") ? "FORBIDDEN" : "UNAUTHORIZED", error.message.includes("Forbidden") ? 403 : 401)
    }
    return apiError(error.message || "Inventory analysis failed", "INTERNAL_ERROR", 500)
  }
}
