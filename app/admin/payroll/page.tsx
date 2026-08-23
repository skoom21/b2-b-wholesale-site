"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Plus, DollarSign } from "lucide-react"
import { fetchStaff, fetchPayrollRecords, createPayrollRecord, updatePayrollStatus, type StaffMember, type PayrollRecord } from "@/lib/api-client"

export default function AdminPayrollPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    staff_id: "",
    period_start: "",
    period_end: "",
    gross_amount: "",
    deductions: "0",
  })

  const load = async () => {
    try {
      setLoading(true)
      const [staffData, recordsData] = await Promise.all([fetchStaff(), fetchPayrollRecords()])
      setStaff(staffData.staff || [])
      setRecords(recordsData.records || [])
      setError(null)
    } catch (err: any) {
      setError(err.message || "Failed to load payroll")
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
      await createPayrollRecord({
        staff_id: form.staff_id,
        period_start: form.period_start,
        period_end: form.period_end,
        gross_amount: parseFloat(form.gross_amount),
        deductions: parseFloat(form.deductions || "0"),
      })
      setShowForm(false)
      setForm({ staff_id: "", period_start: "", period_end: "", gross_amount: "", deductions: "0" })
      await load()
    } catch (err: any) {
      setFormError(err.message || "Failed to create pay period")
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkPaid = async (id: string) => {
    try {
      setUpdatingId(id)
      await updatePayrollStatus(id, "paid")
      await load()
    } catch (err: any) {
      alert(`Failed to update: ${err.message}`)
    } finally {
      setUpdatingId(null)
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
          <h1 className="text-3xl font-bold text-secondary">Payroll</h1>
          <p className="text-muted-foreground">Tracked pay periods for your staff — records only, no payment processing yet</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={staff.length === 0}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Plus size={18} />
          New Pay Period
        </button>
      </div>

      {staff.length === 0 && (
        <div className="card">
          <p className="text-sm text-muted-foreground">Add a staff member first before creating pay periods.</p>
        </div>
      )}

      {showForm && (
        <div className="card">
          <h2 className="text-xl font-bold text-secondary mb-4">New Pay Period</h2>
          {formError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-4 text-sm">
              {formError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Staff Member *</label>
              <select name="staff_id" value={form.staff_id} onChange={handleChange} className="input w-full" required>
                <option value="">Select staff member</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.users?.full_name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Period Start *</label>
                <input name="period_start" type="date" value={form.period_start} onChange={handleChange} className="input w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Period End *</label>
                <input name="period_end" type="date" value={form.period_end} onChange={handleChange} className="input w-full" required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Gross Amount ($) *</label>
                <input name="gross_amount" type="number" min="0" step="0.01" value={form.gross_amount} onChange={handleChange} className="input w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Deductions ($)</label>
                <input name="deductions" type="number" min="0" step="0.01" value={form.deductions} onChange={handleChange} className="input w-full" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
                {submitting ? "Creating..." : "Create Pay Period"}
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
        {records.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="mx-auto text-muted-foreground/50 mb-3" size={40} />
            <p className="text-sm text-muted-foreground">No pay periods yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold">Staff</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Period</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Net Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-border hover:bg-muted">
                    <td className="px-4 py-3 text-sm font-medium">{r.staff_details?.users?.full_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(r.period_start).toLocaleDateString()} – {new Date(r.period_end).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold">${r.net_amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`status-badge ${r.status === "paid" ? "status-green" : "status-yellow"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.status !== "paid" && (
                        <button
                          onClick={() => handleMarkPaid(r.id)}
                          disabled={updatingId === r.id}
                          className="text-primary text-xs font-bold hover:underline disabled:opacity-50"
                        >
                          {updatingId === r.id ? "..." : "Mark Paid"}
                        </button>
                      )}
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
