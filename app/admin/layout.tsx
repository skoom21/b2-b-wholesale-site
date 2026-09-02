"use client"

import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { LogOut, Menu, X } from "lucide-react"
import { getCurrentUser, signOut, getUserRole } from "@/lib/auth"
import { PoweredByFooter } from "@/components/powered-by-footer"

export default function AdminLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      try {
        console.log('[ADMIN LAYOUT] Loading user...')
        const currentUser = await getCurrentUser()
        console.log('[ADMIN LAYOUT] User loaded:', { hasUser: !!currentUser, userId: currentUser?.id, role: currentUser?.user_metadata?.role })
        
        if (currentUser) {
          const role = getUserRole(currentUser)
          if (role === 'owner') {
            router.push('/owner/dashboard')
            return
          }
          if (role !== 'admin' && role !== 'staff' && role !== 'manager') {
            console.log('[ADMIN LAYOUT] User is not admin/staff, redirecting...')
            router.push('/retailer/dashboard')
            return
          }
        }
        
        setUser(currentUser)
      } catch (error) {
        console.error('[ADMIN LAYOUT] Error loading user:', error)
        // Middleware will handle redirect to login
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [router])

  const handleLogout = async () => {
    try {
      console.log('[ADMIN LAYOUT] Logging out...')
      await signOut()
      router.push("/login")
    } catch (error) {
      console.error('[ADMIN LAYOUT] Logout error:', error)
    }
  }

  const navItems = [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Orders", href: "/admin/orders" },
    { label: "Inventory", href: "/admin/inventory" },
    { label: "Stores", href: "/admin/stores" },
    { label: "Staff", href: "/admin/staff" },
    { label: "Payroll", href: "/admin/payroll" },
    { label: "Reports", href: "/admin/reports" },
    { label: "AI Planner", href: "/admin/ai-planner" },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm">
                T
              </div>
              <span className="font-semibold text-foreground text-base tracking-tight">Admin</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{user?.email}</span>
            </div>
            <button onClick={handleLogout} className="btn-secondary flex items-center gap-2" title="Sign out">
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>

          <button className="md:hidden btn-ghost" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden border-t border-border bg-card">
            <nav className="flex flex-col p-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-muted"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">{children}</main>
      <PoweredByFooter />
    </div>
  )
}
