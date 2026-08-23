"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signUp, createStore } from "@/lib/auth"
import type { StoreType } from "@/lib/types"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    storeName: "",
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    businessType: "" as StoreType | "",
    city: "",
    phone: "",
    address: "",
    province: "",
    postalCode: "",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      // Validation
      if (!formData.storeName || !formData.fullName || !formData.email || !formData.password || !formData.businessType || !formData.city) {
        throw new Error("Please fill in all required fields")
      }

      if (formData.password.length < 6) {
        throw new Error("Password must be at least 6 characters")
      }

      if (formData.password !== formData.confirmPassword) {
        throw new Error("Passwords do not match")
      }

      // Step 1: Create user account
      const { user, session } = await signUp(formData.email, formData.password, {
        full_name: formData.fullName,
        phone: formData.phone || undefined,
      })

      if (!user) {
        throw new Error('User account creation failed')
      }

      // Step 2: Create store for the user
      await createStore(user.id, {
        name: formData.storeName,
        email: formData.email,
        phone: formData.phone,
        address_line1: formData.address,
        city: formData.city,
        province: formData.province || 'ON',
        postal_code: formData.postalCode,
        store_type: formData.businessType as StoreType,
      })

      // Step 3: Redirect based on session status
      if (session) {
        // Auto-confirmed, redirect to dashboard
        router.push("/retailer/dashboard")
      } else {
        // Email confirmation required
        alert('Registration successful! Please check your email to confirm your account.')
        router.push("/login")
      }
    } catch (err: any) {
      console.error('Registration error:', err)
      if (err.message && err.message.includes("User already registered")) {
        setError("Account already exists with this email. Please log in.")
      } else {
        setError(err.message || "Failed to register. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 py-12 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ background: "linear-gradient(135deg, #0f766e, #6366f1)" }}
          >
            P
          </div>
          <span className="text-xl font-semibold tracking-tight text-foreground">Pallet</span>
        </div>

        <div className="card">
          <h2 className="text-2xl font-semibold text-foreground mb-1">Register your store</h2>
          <p className="text-sm text-muted-foreground mb-6">Join verified retailers across Canada</p>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Store Name *</label>
              <input
                type="text"
                name="storeName"
                value={formData.storeName}
                onChange={handleChange}
                placeholder="Your Store Name"
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Full Name *</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="John Doe"
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email Address *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Business Type *</label>
              <select
                name="businessType"
                value={formData.businessType}
                onChange={handleChange}
                className="input w-full"
                required
              >
                <option value="">Select a type</option>
                <option value="grocery_store">Grocery Store</option>
                <option value="restaurant">Restaurant</option>
                <option value="distributor">Distributor</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">City *</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Toronto"
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="123 Main St"
                className="input w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Province</label>
                <input
                  type="text"
                  name="province"
                  value={formData.province}
                  onChange={handleChange}
                  placeholder="ON"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Postal Code</label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  placeholder="M5V 3A8"
                  className="input w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1 (555) 000-0000"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Password *</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="input w-full"
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground mt-1">At least 6 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Confirm Password *</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className="input w-full"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50 mt-6">
              {loading ? "Creating Account..." : "Register Store"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already registered?{" "}
              <Link href="/login" className="text-primary font-bold hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
