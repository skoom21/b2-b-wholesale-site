"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, AlertCircle, Copy } from "lucide-react"
import { fetchBrands, createBrand, type Brand } from "@/lib/api-client"

export default function OwnerBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; temp_password: string } | null>(null)

  const [form, setForm] = useState({
    name: "",
    slug: "",
    admin_email: "",
    admin_full_name: "",
    plan_name: "",
    billing_interval: "monthly" as "monthly" | "yearly",
    amount: "",
  })

  const load = async () => {
    try {
      setLoading(true)
      const data = await fetchBrands()
      setBrands(data.brands || [])
      setError(null)
    } catch (err: any) {
      setError(err.message || "Failed to load brands")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      const result = await createBrand({
        name: form.name,
        slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        admin_email: form.admin_email,
        admin_full_name: form.admin_full_name,
        plan_name: form.plan_name || undefined,
        billing_interval: form.billing_interval,
        amount: form.amount ? parseFloat(form.amount) : undefined,
      })
      if (result.admin_account) {
        setCreatedCredentials(result.admin_account)
      } else if (result.admin_account_error) {
        setFormError(`Brand created, but the admin account failed: ${result.admin_account_error}`)
      }
      setShowForm(false)
      setForm({ name: "", slug: "", admin_email: "", admin_full_name: "", plan_name: "", billing_interval: "monthly", amount: "" })
      await load()
    } catch (err: any) {
      setFormError(err.message || "Failed to create brand")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading brands...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Brands</h1>
          <p className="text-muted-foreground">Every tenant running on this platform</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary inline-flex items-center gap-2">
          <Plus size={18} />
          New Brand
        </button>
      </div>

      {createdCredentials && (
        <div className="card border-l-4 border-l-primary">
          <h3 className="font-bold text-secondary mb-2">Brand admin account created</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Share these credentials with the new brand's admin. They should change the password after first login.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 text-sm font-mono space-y-1">
            <div className="flex items-center justify-between">
              <span>Email: {createdCredentials.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Temp password: {createdCredentials.temp_password}</span>
              <button
                onClick={() => navigator.clipboard.writeText(`${createdCredentials.email} / ${createdCredentials.temp_password}`)}
                className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
          </div>
          <button onClick={() => setCreatedCredentials(null)} className="btn-ghost text-sm mt-3">Dismiss</button>
        </div>
      )}

      {showForm && (
        <div className="card">
          <h2 className="text-xl font-bold text-secondary mb-4">Create a New Brand</h2>
          {formError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-4 text-sm">
              {formError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Brand Name *</label>
                <input name="name" value={form.name} onChange={handleChange} className="input w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Slug</label>
                <input name="slug" value={form.slug} onChange={handleChange} placeholder="auto-generated if blank" className="input w-full" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Admin Email *</label>
                <input name="admin_email" type="email" value={form.admin_email} onChange={handleChange} className="input w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Admin Full Name *</label>
                <input name="admin_full_name" value={form.admin_full_name} onChange={handleChange} className="input w-full" required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Plan Name</label>
                <input name="plan_name" value={form.plan_name} onChange={handleChange} placeholder="e.g. Standard" className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Billing Interval</label>
                <select name="billing_interval" value={form.billing_interval} onChange={handleChange} className="input w-full">
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Amount ($)</label>
                <input name="amount" type="number" min="0" step="0.01" value={form.amount} onChange={handleChange} className="input w-full" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
                {submitting ? "Creating..." : "Create Brand"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="card">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle size={20} />
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="card">
        {brands.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No brands yet. Create the first one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold">Brand</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Admin Email</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Stores</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Plan</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((brand) => (
                  <tr key={brand.id} className="border-b border-border hover:bg-muted">
                    <td className="px-4 py-3 text-sm font-medium">
                      <Link href={`/owner/brands/${brand.id}`} className="text-primary hover:underline">
                        {brand.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{brand.admin_email || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`status-badge ${brand.status === "active" ? "status-green" : "status-red"}`}>
                        {brand.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{brand.store_count}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {brand.brand_subscriptions?.[0]?.plan_name || "—"}
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
