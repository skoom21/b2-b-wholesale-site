"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Building2,
  DollarSign,
  Store,
  AlertCircle,
  Lightbulb,
  Megaphone,
  Rocket,
  ChevronDown,
  ChevronUp,
  BellRing,
} from "lucide-react"
import { fetchBrands, type Brand } from "@/lib/api-client"
import { getCurrentUser } from "@/lib/auth"

type Insight = {
  title: string
  description: string
  tone: "action" | "good"
}

type ExpiryAlert = {
  brandId: string
  brandName: string
  status: string
  daysLeft: number
}

function getExpiryAlerts(brands: Brand[]): ExpiryAlert[] {
  const alerts: ExpiryAlert[] = []
  for (const b of brands) {
    const sub = b.brand_subscriptions?.[0]
    if (!sub || !sub.current_period_end) continue
    if (sub.status !== "trialing" && sub.status !== "active") continue
    const daysLeft = Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 3) {
      alerts.push({ brandId: b.id, brandName: b.name, status: sub.status, daysLeft })
    }
  }
  return alerts.sort((a, b) => a.daysLeft - b.daysLeft)
}

function generateInsights(brands: Brand[]): Insight[] {
  const insights: Insight[] = []

  if (brands.length === 0) {
    insights.push({
      tone: "action",
      title: "Onboard your first paying brand",
      description: "You have no brands yet besides your own. Head to Brands → New Brand to create one for a wholesale customer.",
    })
    return insights
  }

  const noPlan = brands.filter((b) => !b.brand_subscriptions?.[0]?.plan_name)
  if (noPlan.length > 0) {
    insights.push({
      tone: "action",
      title: `${noPlan.length} brand${noPlan.length > 1 ? "s have" : " has"} no subscription plan set`,
      description: `${noPlan.map((b) => b.name).join(", ")} — set a plan and price on their brand page so you're tracking real recurring revenue, even before you bill for it.`,
    })
  }

  const trialing = brands.filter((b) => b.brand_subscriptions?.[0]?.status === "trialing")
  if (trialing.length > 0) {
    insights.push({
      tone: "action",
      title: `${trialing.length} brand${trialing.length > 1 ? "s are" : " is"} on trial`,
      description: `${trialing.map((b) => b.name).join(", ")} — follow up before the trial period ends to convert them to a paid plan.`,
    })
  }

  const lowActivity = brands.filter((b) => (b.store_count || 0) > 20)
  if (lowActivity.length > 0) {
    insights.push({
      tone: "good",
      title: "Strong store adoption",
      description: `${lowActivity.map((b) => `${b.name} (${b.store_count} stores)`).join(", ")} already has real retailer volume — a good case study to show prospective brands.`,
    })
  }

  const suspended = brands.filter((b) => b.status === "suspended" || b.status === "cancelled")
  if (suspended.length > 0) {
    insights.push({
      tone: "action",
      title: `${suspended.length} brand${suspended.length > 1 ? "s need" : " needs"} attention`,
      description: `${suspended.map((b) => `${b.name} (${b.status})`).join(", ")} — reach out to understand why before the relationship goes cold.`,
    })
  }

  if (insights.length === 0) {
    insights.push({
      tone: "good",
      title: "Everything's in good shape",
      description: "All brands have active plans and no outstanding issues. Focus on outreach to bring on the next one.",
    })
  }

  return insights
}

const sellingPoints = [
  {
    title: "Lead with the pain, not the features",
    body: "Most small wholesale distributors run inventory on spreadsheets or paper. Open with “How are you tracking who owes you money right now?” — the credit/dues tracking usually lands harder than any feature list.",
  },
  {
    title: "Show, don't pitch",
    body: "Give a prospective brand a live 10-minute walkthrough on their own laptop: add a product, take a test order, watch the invoice generate. Wholesale buyers trust what they can click through, not slide decks.",
  },
  {
    title: "Isolation is a selling point, say it out loud",
    body: "Tell them plainly: their inventory, customers, and staff are on a completely separate, private account — nothing they enter is visible to any other brand on the platform, including you unless they ask for support.",
  },
  {
    title: "Start them on a trial, not a contract",
    body: "The platform already supports a ‘trialing’ subscription status — use it. Free first month removes the biggest objection (“what if it doesn't work for us”) and gives you a real case study either way.",
  },
  {
    title: "Price against their current cost, not against software",
    body: "They're not comparing you to other SaaS — they're comparing you to a spreadsheet + a part-time bookkeeper. Frame the monthly fee against the hours it saves their staff each week.",
  },
]

const roadmapSuggestions = [
  "Customer ledger view — dues/payments already exist as data; a dedicated ledger page makes it something you can demo, not just describe.",
  "Attendance & overtime tracking — payroll records exist, but there's no way to log hours yet, which is half the reason a distributor would want the HR module at all.",
  "Profit margins on the dashboard — best/worst sellers and sales trends already show; margin-per-product is the natural next KPI for a wholesale buyer.",
  "Real subdomains per brand — once you own a domain, brandA.yourdomain.com reads as a much more serious product than a shared URL with a brand switcher.",
  "Granular staff permissions — right now any staff account is admin-equivalent within their brand; useful once a brand wants to give a warehouse worker order-only access.",
]

export default function OwnerDashboard() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState<string>("")
  const [showSellingPoints, setShowSellingPoints] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [data, user] = await Promise.all([fetchBrands(), getCurrentUser()])
        setBrands(data.brands || [])
        setOwnerName(user?.user_metadata?.full_name || "")
        setError(null)
      } catch (err: any) {
        setError(err.message || "Failed to load brands")
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
          <p className="mt-4 text-muted-foreground">Loading platform overview...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle size={20} />
          <p>Error: {error}</p>
        </div>
      </div>
    )
  }

  const activeBrands = brands.filter(b => b.status === "active").length
  const totalStores = brands.reduce((sum, b) => sum + (b.store_count || 0), 0)
  const monthlyRevenue = brands.reduce((sum, b) => {
    const sub = b.brand_subscriptions?.[0]
    if (!sub) return sum
    return sum + (sub.billing_interval === "yearly" ? sub.amount / 12 : sub.amount)
  }, 0)
  const insights = generateInsights(brands)
  const expiryAlerts = getExpiryAlerts(brands)
  const firstName = ownerName.split(" ")[0]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-secondary">
            {firstName ? `Welcome back, ${firstName}` : "Platform Overview"}
          </h1>
          <p className="text-muted-foreground">Every brand running on this platform, in one place</p>
        </div>
        <Link href="/owner/brands" className="btn-primary">
          Manage Brands
        </Link>
      </div>

      {expiryAlerts.length > 0 && (
        <div className="rounded-2xl border-l-4 border-l-destructive bg-destructive/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <BellRing size={18} className="text-destructive" />
            <h2 className="text-base font-bold text-secondary">Subscription Alerts</h2>
          </div>
          <div className="space-y-2">
            {expiryAlerts.map((a) => (
              <Link
                key={a.brandId}
                href={`/owner/brands/${a.brandId}`}
                className="flex items-center justify-between text-sm p-2 -mx-2 rounded-lg hover:bg-destructive/10 transition-colors"
              >
                <span className="text-foreground font-medium">{a.brandName}</span>
                <span className={a.daysLeft < 0 ? "text-destructive font-semibold" : "text-amber-600 font-semibold"}>
                  {a.daysLeft < 0
                    ? `${a.status === "trialing" ? "Trial ended" : "Expired"} ${Math.abs(a.daysLeft)}d ago`
                    : a.daysLeft === 0
                    ? `${a.status === "trialing" ? "Trial ends" : "Renews"} today`
                    : `${a.status === "trialing" ? "Trial ends" : "Renews"} in ${a.daysLeft}d`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Active Brands</p>
              <p className="text-2xl font-bold text-secondary mt-2">{activeBrands}</p>
              <p className="text-xs text-muted-foreground mt-1">{brands.length} total</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="text-primary" size={22} />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Retailer Stores</p>
              <p className="text-2xl font-bold text-secondary mt-2">{totalStores}</p>
              <p className="text-xs text-muted-foreground mt-1">Across all brands</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Store className="text-primary" size={22} />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Tracked Monthly Revenue</p>
              <p className="text-2xl font-bold text-secondary mt-2">${monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-1">From subscription records (not billed)</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="text-primary" size={22} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb size={18} className="text-primary" />
          <h2 className="text-xl font-bold text-secondary">Insights</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Generated from your actual brand data — not a live AI call, just rules that watch for things worth your attention.
        </p>
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={`rounded-lg p-4 border-l-4 ${
                insight.tone === "action"
                  ? "bg-amber-50 border-l-amber-400"
                  : "bg-emerald-50 border-l-emerald-400"
              }`}
            >
              <p className="text-sm font-bold text-secondary">{insight.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setShowSellingPoints(!showSellingPoints)}
          >
            <div className="flex items-center gap-2">
              <Megaphone size={18} className="text-primary" />
              <h2 className="text-lg font-bold text-secondary">How to sell this to a brand</h2>
            </div>
            {showSellingPoints ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
          </button>
          {showSellingPoints && (
            <div className="space-y-4 mt-4">
              {sellingPoints.map((point, i) => (
                <div key={i}>
                  <p className="text-sm font-bold text-secondary">{point.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{point.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setShowRoadmap(!showRoadmap)}
          >
            <div className="flex items-center gap-2">
              <Rocket size={18} className="text-primary" />
              <h2 className="text-lg font-bold text-secondary">What to build next</h2>
            </div>
            {showRoadmap ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
          </button>
          {showRoadmap && (
            <ul className="space-y-3 mt-4">
              {roadmapSuggestions.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-secondary">Brands</h2>
          <Link href="/owner/brands" className="text-primary font-medium text-sm hover:underline">
            View All
          </Link>
        </div>
        {brands.length === 0 ? (
          <p className="text-sm text-muted-foreground">No brands yet — create the first one from the Brands page.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold">Brand</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Stores</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Plan</th>
                </tr>
              </thead>
              <tbody>
                {brands.slice(0, 10).map((brand) => (
                  <tr key={brand.id} className="border-b border-border hover:bg-muted">
                    <td className="px-4 py-3 text-sm font-medium">
                      <Link href={`/owner/brands/${brand.id}`} className="text-primary hover:underline">
                        {brand.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`status-badge ${brand.status === "active" ? "status-green" : "status-red"}`}>
                        {brand.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{brand.store_count}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {brand.brand_subscriptions?.[0]?.plan_name || "No plan set"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
