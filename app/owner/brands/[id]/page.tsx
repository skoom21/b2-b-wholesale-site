"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Building2, ExternalLink, Package, ShoppingCart, Store, Users } from "lucide-react"
import { fetchBrand, updateBrand, sendBrandAdminPasswordReset, createBrandAdmin, type Brand } from "@/lib/api-client"

export default function OwnerBrandDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [brand, setBrand] = useState<Brand | null>(null)
  const [staff, setStaff] = useState<any[]>([])
  const [admins, setAdmins] = useState<{ id: string; email: string; full_name: string; phone: string | null; is_active: boolean; last_login_at: string | null; created_at: string }[]>([])
  const [counts, setCounts] = useState({ stores: 0, products: 0, orders: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [resetSentFor, setResetSentFor] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [adminForm, setAdminForm] = useState({ email: "", full_name: "" })
  const [creatingAdmin, setCreatingAdmin] = useState(false)
  const [adminFormError, setAdminFormError] = useState<string | null>(null)
  const [createdAdminAccount, setCreatedAdminAccount] = useState<{ email: string; temp_password: string } | null>(null)

  const [editingSub, setEditingSub] = useState(false)
  const [subDraft, setSubDraft] = useState({ plan_name: "", billing_interval: "monthly", amount: "", status: "trialing" })
  const [savingSub, setSavingSub] = useState(false)
  const [subError, setSubError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await fetchBrand(id)
      setBrand(data.brand)
      setStaff(data.staff || [])
      setAdmins(data.admins || [])
      setCounts(data.counts)
      setError(null)
    } catch (err: any) {
      setError(err.message || "Failed to load brand")
    } finally {
      setLoading(false)
    }
  }

  const handleSendReset = async (email: string) => {
    try {
      setResetError(null)
      await sendBrandAdminPasswordReset(email)
      setResetSentFor(email)
    } catch (err: any) {
      setResetError(err.message || "Failed to send reset link")
    }
  }

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminFormError(null)
    setCreatingAdmin(true)
    try {
      const result = await createBrandAdmin(id, adminForm)
      setCreatedAdminAccount(result.admin_account)
      setAdminForm({ email: "", full_name: "" })
      await load()
    } catch (err: any) {
      setAdminFormError(err.message || "Failed to create admin account")
    } finally {
      setCreatingAdmin(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const startEditingSub = () => {
    const sub = brand?.brand_subscriptions?.[0]
    setSubDraft({
      plan_name: sub?.plan_name || "",
      billing_interval: sub?.billing_interval || "monthly",
      amount: sub?.amount != null ? String(sub.amount) : "",
      status: sub?.status || "trialing",
    })
    setSubError(null)
    setEditingSub(true)
  }

  const saveSub = async () => {
    if (!subDraft.plan_name.trim()) {
      setSubError("Give the plan a name")
      return
    }
    const amount = parseFloat(subDraft.amount)
    if (isNaN(amount) || amount < 0) {
      setSubError("Enter a valid price")
      return
    }
    try {
      setSavingSub(true)
      setSubError(null)
      await updateBrand(id, {
        subscription: {
          plan_name: subDraft.plan_name.trim(),
          billing_interval: subDraft.billing_interval as any,
          amount,
          status: subDraft.status as any,
        },
      })
      setEditingSub(false)
      await load()
    } catch (err: any) {
      setSubError(err.message || "Failed to save plan")
    } finally {
      setSavingSub(false)
    }
  }

  const handleStatusChange = async (status: "active" | "suspended" | "cancelled") => {
    try {
      setUpdating(true)
      await updateBrand(id, { status })
      await load()
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`)
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !brand) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle size={20} />
          <p>{error || "Brand not found"}</p>
        </div>
      </div>
    )
  }

  const subscription = brand.brand_subscriptions?.[0]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Building2 className="text-primary" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-secondary">{brand.name}</h1>
            <p className="text-muted-foreground">{brand.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/brands/${brand.slug}`} target="_blank" className="btn-secondary inline-flex items-center gap-2">
            Public storefront <ExternalLink size={15} />
          </Link>
          <span className={`status-badge ${brand.status === "active" ? "status-green" : "status-red"}`}>
            {brand.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Stores</p>
              <p className="text-2xl font-bold text-secondary mt-2">{counts.stores}</p>
            </div>
            <Store className="text-primary opacity-20" size={32} />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Products</p>
              <p className="text-2xl font-bold text-secondary mt-2">{counts.products}</p>
            </div>
            <Package className="text-primary opacity-20" size={32} />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Orders</p>
              <p className="text-2xl font-bold text-secondary mt-2">{counts.orders}</p>
            </div>
            <ShoppingCart className="text-primary opacity-20" size={32} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-secondary">Subscription</h2>
          {!editingSub && (
            <button onClick={startEditingSub} className="text-sm font-semibold text-primary hover:underline">
              {subscription ? "Edit Plan" : "Set Plan"}
            </button>
          )}
        </div>

        {editingSub ? (
          <div className="space-y-3">
            {subError && <p className="text-xs text-destructive">{subError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Plan Name</label>
                <input
                  type="text"
                  value={subDraft.plan_name}
                  onChange={(e) => setSubDraft({ ...subDraft, plan_name: e.target.value })}
                  placeholder="e.g. Standard"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Price ($)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={subDraft.amount}
                  onChange={(e) => setSubDraft({ ...subDraft, amount: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Billing Interval</label>
                <select
                  value={subDraft.billing_interval}
                  onChange={(e) => setSubDraft({ ...subDraft, billing_interval: e.target.value })}
                  className="input w-full"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Status</label>
                <select
                  value={subDraft.status}
                  onChange={(e) => setSubDraft({ ...subDraft, status: e.target.value })}
                  className="input w-full"
                >
                  <option value="trialing">Trialing</option>
                  <option value="active">Active</option>
                  <option value="past_due">Past Due</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveSub} disabled={savingSub} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                {savingSub ? "Saving..." : "Save Plan"}
              </button>
              <button onClick={() => setEditingSub(false)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
            </div>
          </div>
        ) : subscription ? (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase font-bold">Plan</p>
                <p className="font-medium">{subscription.plan_name || "No plan set"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase font-bold">Amount</p>
                <p className="font-medium">${subscription.amount} / {subscription.billing_interval}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase font-bold">Status</p>
                <span className={`status-badge ${subscription.status === "active" ? "status-green" : subscription.status === "trialing" ? "status-blue" : "status-red"}`}>
                  {subscription.status}
                </span>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase font-bold">
                  {subscription.status === "trialing" ? "Trial Ends" : "Renews"}
                </p>
                <p className="font-medium">{new Date(subscription.current_period_end).toLocaleDateString()}</p>
              </div>
            </div>
            {(() => {
              const daysLeft = Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              if (subscription.status === "cancelled") return null
              if (daysLeft < 0) {
                return <p className="text-sm text-destructive font-semibold mt-4">
                  {subscription.status === "trialing" ? "Trial ended" : "Subscription expired"} {Math.abs(daysLeft)} day{Math.abs(daysLeft) === 1 ? "" : "s"} ago.
                </p>
              }
              if (daysLeft <= 3) {
                return <p className="text-sm text-amber-600 font-semibold mt-4">
                  {subscription.status === "trialing" ? "Trial ends" : "Renews"} in {daysLeft} day{daysLeft === 1 ? "" : "s"}.
                </p>
              }
              return null
            })()}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No subscription record set for this brand yet.</p>
        )}
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-muted-foreground" />
          <h2 className="text-xl font-bold text-secondary">Brand Admin</h2>
        </div>
        {resetError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-4 text-sm">
            {resetError}
          </div>
        )}

        {createdAdminAccount && (
          <div className="bg-primary/5 border-l-4 border-l-primary rounded-lg p-4 mb-4">
            <p className="text-sm font-bold text-secondary mb-2">Admin account created</p>
            <p className="text-xs text-muted-foreground mb-3">
              Send these to them yourself — this is the only time the password is shown.
            </p>
            <div className="bg-card rounded-lg p-3 text-sm font-mono space-y-1">
              <p>Email: {createdAdminAccount.email}</p>
              <p>Password: {createdAdminAccount.temp_password}</p>
            </div>
            <button onClick={() => setCreatedAdminAccount(null)} className="btn-ghost text-xs mt-2">Dismiss</button>
          </div>
        )}

        {admins.length === 0 ? (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              No admin account exists for this brand yet — it was likely never created, or creation failed. Add one below to give them a login.
            </p>
            {adminFormError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-4 text-sm">
                {adminFormError}
              </div>
            )}
            <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Full Name"
                value={adminForm.full_name}
                onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })}
                className="input"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                className="input"
                required
              />
              <button type="submit" disabled={creatingAdmin} className="btn-primary sm:col-span-2 disabled:opacity-50">
                {creatingAdmin ? "Creating..." : "Create Admin Account"}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{a.full_name}</p>
                    <span className={`status-badge ${a.is_active ? "status-green" : "status-gray"}`}>
                      {a.is_active ? "active" : "inactive"}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">{a.email}</p>
                  <p className="text-muted-foreground text-xs">{a.phone || "No phone on file"}</p>
                  <p className="text-muted-foreground text-xs">
                    {a.last_login_at
                      ? `Last login ${new Date(a.last_login_at).toLocaleDateString()}`
                      : "Never logged in"}
                  </p>
                </div>
                {resetSentFor === a.email ? (
                  <span className="text-xs text-primary font-medium">Reset link sent</span>
                ) : (
                  <button
                    onClick={() => handleSendReset(a.email)}
                    className="text-primary text-xs font-bold hover:underline"
                  >
                    Send password reset link
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Passwords can't be viewed after creation — only the admin who owns the account can set a new one, via this reset link.
        </p>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-muted-foreground" />
          <h2 className="text-xl font-bold text-secondary">Staff</h2>
        </div>
        {staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">No staff added for this brand yet.</p>
        ) : (
          <div className="space-y-2">
            {staff.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
                <div>
                  <p className="font-medium">{s.users?.full_name}</p>
                  <p className="text-muted-foreground text-xs">{s.users?.email} · {s.job_title || "No title"}</p>
                </div>
                <span className="status-badge status-gray">{s.employment_status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-secondary mb-4">Manage</h2>
        <div className="flex flex-wrap gap-3">
          {brand.status !== "active" && (
            <button onClick={() => handleStatusChange("active")} disabled={updating} className="btn-primary disabled:opacity-50">
              Activate Brand
            </button>
          )}
          {brand.status !== "suspended" && (
            <button onClick={() => handleStatusChange("suspended")} disabled={updating} className="btn-secondary disabled:opacity-50">
              Suspend Brand
            </button>
          )}
          {brand.status !== "cancelled" && (
            <button
              onClick={() => handleStatusChange("cancelled")}
              disabled={updating}
              className="bg-card border-2 border-rose-100 text-rose-600 hover:bg-rose-50 font-bold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50"
            >
              Cancel Brand
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
