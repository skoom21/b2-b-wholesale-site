"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "@/lib/auth"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[LOGIN PAGE] Form submitted')
    setError("")
    setLoading(true)

    try {
      if (!email || !password) {
        console.error('[LOGIN PAGE] Missing email or password')
        throw new Error("Please fill in all fields")
      }

      console.log('[LOGIN PAGE] Calling signIn...')
      const result = await signIn(email, password)
      console.log('[LOGIN PAGE] signIn completed, result:', { 
        hasUser: !!result.user, 
        hasSession: !!result.session,
        userId: result.user?.id,
        role: result.user?.user_metadata?.role
      })
      
      console.log('[LOGIN PAGE] Refreshing router...')
      router.refresh()
      
      // Redirect based on role
      const role = result.user?.user_metadata?.role || 'retailer'
      const dashboardPath = role === 'admin' ? '/admin/dashboard' : '/retailer/dashboard'
      console.log('[LOGIN PAGE] Redirecting to', dashboardPath)
      window.location.href = dashboardPath
    } catch (err: any) {
      console.error('[LOGIN PAGE] Login error:', err)
      setError(err.message || "Failed to sign in")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
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
          <h2 className="text-2xl font-semibold text-foreground mb-1">Sign in</h2>
          <p className="text-sm text-muted-foreground mb-6">Welcome back to your account</p>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input w-full"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input w-full"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Need access?{" "}
              <Link href="/register" className="text-primary font-semibold hover:underline">
                Request an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
