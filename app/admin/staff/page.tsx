"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Plus, Copy, Users } from "lucide-react"
import { fetchStaff, createStaff, type StaffMember } from "@/lib/api-client"

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [createdAccount, setCreatedAccount] = useState<{ email: string; temp_password: string } | null>(null)

  const [form, setForm] = useState({
    email: "",
    full_name: "",
    phone: "",
    job_title: "",
    pay_type: "salary" as "salary" | "hourly",
    pay_rate: "",
  })

  const load = async () => {
    try {
      setLoading(true)
      const data = await fetchStaff()
      setStaff(data.staff || [])
      setError(null)
    } catch (err: any) {
      setError(err.message || "Failed to load staff")
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
      const result = await createStaff({
        email: form.email,
        full_name: form.full_name,
        phone: form.phone || undefined,
        job_title: form.job_title || undefined,
        pay_type: form.pay_type,
        pay_rate: form.pay_rate ? parseFloat(form.pay_rate) : undefined,
      })
      setCreatedAccount(result.account)
      setShowForm(false)
      setForm({ email: "", full_name: "", phone: "", job_title: "", pay_type: "salary", pay_rate: "" })
      await load()
    } catch (err: any) {
      setFormError(err.message || "Failed to add staff member")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Staff</h1>
          <p className="text-muted-foreground">Your team members and their employment details</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary inline-flex items-center gap-2">
          <Plus size={18} />
          Add Staff
        </button>
      </div>

      {createdAccount && (
        <div className="card border-l-4 border-l-primary">
          <h3 className="font-bold text-secondary mb-2">Staff account created</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Share these credentials with them directly. They should change the password after first login.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 text-sm font-mono flex items-center justify-between">
            <span>{createdAccount.email} / {createdAccount.temp_password}</span>
            <button
              onClick={() => navigator.clipboard.writeText(`${createdAccount.email} / ${createdAccount.temp_password}`)}
              className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
            >
              <Copy size={12} /> Copy
            </button>
          </div>
          <button onClick={() => setCreatedAccount(null)} className="btn-ghost text-sm mt-3">Dismiss</button>
        </div>
      )}

      {showForm && (
        <div className="card">
          <h2 className="text-xl font-bold text-secondary mb-4">Add a Staff Member</h2>
          {formError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-4 text-sm">
              {formError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Full Name *</label>
                <input name="full_name" value={form.full_name} onChange={handleChange} className="input w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email *</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} className="input w-full" required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Phone</label>
                <input name="phone" value={form.phone} onChange={handleChange} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Job Title</label>
                <input name="job_title" value={form.job_title} onChange={handleChange} className="input w-full" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Pay Type</label>
                <select name="pay_type" value={form.pay_type} onChange={handleChange} className="input w-full">
                  <option value="salary">Salary</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Pay Rate ($ {form.pay_type === "hourly" ? "per hour" : "per year"})
                </label>
                <input name="pay_rate" type="number" min="0" step="0.01" value={form.pay_rate} onChange={handleChange} className="input w-full" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
                {submitting ? "Creating..." : "Add Staff Member"}
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
        {staff.length === 0 ? (
          <div className="text-center py-8">
            <Users className="mx-auto text-muted-foreground/50 mb-3" size={40} />
            <p className="text-sm text-muted-foreground">No staff added yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Pay</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-b border-border hover:bg-muted">
                    <td className="px-4 py-3 text-sm font-medium">
                      {s.users?.full_name}
                      <p className="text-xs text-muted-foreground font-normal">{s.users?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{s.job_title || "—"}</td>
                    <td className="px-4 py-3 text-sm">
                      ${s.pay_rate} {s.pay_type === "hourly" ? "/hr" : "/yr"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`status-badge ${s.employment_status === "active" ? "status-green" : "status-gray"}`}>
                        {s.employment_status}
                      </span>
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
