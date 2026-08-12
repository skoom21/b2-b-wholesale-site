"use client"

import { useState, useEffect } from "react"
import { CheckCircle, Loader2, AlertCircle } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { updateStore, ApiError } from "@/lib/api-client"

export default function SettingsPage() {
  const { store, refetchStore } = useUser()
  const [saved, setSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    contact_email: "",
    contact_phone: "",
    address: "",
    city: "",
    province: "",
    postal_code: "",
  })

  useEffect(() => {
    if (store) {
      setFormData({
        name: store.name || "",
        contact_email: store.contact_email || "",
        contact_phone: store.contact_phone || "",
        address: store.address || "",
        city: store.city || "",
        province: store.province || "",
        postal_code: store.postal_code || "",
      })
    }
  }, [store])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSave = async () => {
    if (!store) return

      try {
      setIsLoading(true)
      setError(null)
      await updateStore(store.id, formData)
      await refetchStore()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error("Failed to save settings:", err)
      setError(err instanceof ApiError ? err.message : "Failed to save settings")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (store) {
      setFormData({
        name: store.name || "",
        contact_email: store.contact_email || "",
        contact_phone: store.contact_phone || "",
        address: store.address || "",
        city: store.city || "",
        province: store.province || "",
        postal_code: store.postal_code || "",
      })
    }
  }

  if (!store) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-secondary">Account Settings</h1>
        <p className="text-muted-foreground">Manage your store information</p>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={18} />
          <p className="font-medium">Your settings have been saved successfully</p>
        </div>
      )}

      {error && (
        <div className="card border-l-4 border-l-red-500">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-500" size={24} />
            <div>
              <p className="font-semibold text-secondary">Error Saving Settings</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl">
        <div className="card">
          <h2 className="text-xl font-bold text-secondary mb-6">Store Information</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-secondary mb-2">Store Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-secondary mb-2">Email Address</label>
              <input
                type="email"
                name="contact_email"
                value={formData.contact_email}
                onChange={handleChange}
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-secondary mb-2">Phone Number</label>
              <input 
                type="tel" 
                name="contact_phone" 
                value={formData.contact_phone} 
                onChange={handleChange} 
                className="input w-full" 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-secondary mb-2">Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="input w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-secondary mb-2">City</label>
                <input 
                  type="text" 
                  name="city" 
                  value={formData.city} 
                  onChange={handleChange} 
                  className="input w-full" 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-secondary mb-2">Province</label>
                <input
                  type="text"
                  name="province"
                  value={formData.province}
                  onChange={handleChange}
                  className="input w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-secondary mb-2">Postal Code</label>
              <input
                type="text"
                name="postal_code"
                value={formData.postal_code}
                onChange={handleChange}
                className="input w-full"
              />
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                onClick={handleSave} 
                disabled={isLoading}
                className="btn-primary disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading && <Loader2 className="animate-spin" size={16} />}
                {isLoading ? "Saving..." : "Save Changes"}
              </button>
              <button 
                onClick={handleCancel}
                disabled={isLoading}
                className="btn-secondary disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <div className="card mt-6">
          <h2 className="text-xl font-bold text-secondary mb-4">Account Tier</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-secondary">
                {store.tier.charAt(0).toUpperCase() + store.tier.slice(1)} Tier
              </p>
              <p className="text-sm text-muted-foreground">
                {store.tier === 'bronze' && '5% discount on all products'}
                {store.tier === 'silver' && '10% discount on all products'}
                {store.tier === 'gold' && '15% discount on all products'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">
                {store.tier.toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        <div className="card mt-6">
          <h2 className="text-xl font-bold text-secondary mb-4">Credit Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Credit Limit</span>
              <span className="font-semibold text-secondary">
                ${store.credit_limit.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Credit Used</span>
              <span className="font-semibold text-red-600">
                ${store.credit_used.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <span className="font-bold text-secondary">Credit Available</span>
              <span className="font-bold text-primary text-lg">
                ${store.credit_available.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
