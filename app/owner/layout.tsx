"use client"

import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { LogOut, Menu, X } from "lucide-react"
import { getCurrentUser, signOut, getUserRole } from "@/lib/auth"
import { PoweredByFooter } from "@/components/powered-by-footer"

export default function OwnerLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (currentUser) {
          const role = getUserRole(currentUser)
          if (role !== 'owner') {
            router.push(role === 'admin' || role === 'staff' || role === 'manager' ? '/admin/dashboard' : '/retailer/dashboard')
            return
          }
        }
        setUser(currentUser)
      } catch (error) {
        console.error('[OWNER LAYOUT] Error loading user:', error)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [router])

  const handleLogout = async () => {
    try {
      await signOut()
      router.push("/login")
    } catch (error) {
      console.error('[OWNER LAYOUT] Logout error:', error)
    }
  }

  const navItems = [
    { label: "Dashboard", href: "/owner/dashboard" },
    { label: "Brands", href: "/owner/brands" },
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
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center text-secondary-foreground font-bold text-sm">
                O
              </div>
              <span className="font-semibold text-foreground text-base tracking-tight">Platform Owner</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.href || pathname.startsWith(item.href + "/")
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
