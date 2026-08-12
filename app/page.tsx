"use client";

import Link from "next/link";
import { ArrowRight, Lock, BarChart3, Zap, ShieldCheck, LayoutDashboard } from "lucide-react";

export default function LandingPage() {
  return (
    <>
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm">
              T
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">Teetoz</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost">
              Login
            </Link>
            <Link href="/register" className="btn-primary">
              Register
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-background py-28">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(600px circle at 15% 20%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 60%)",
            }}
          />
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Built for Indian food distribution
              </div>
              <h2 className="text-5xl font-semibold text-foreground mb-6 text-balance leading-[1.1]">
                Streamlined ordering for wholesale food distribution
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-xl">
                Real-time inventory, tiered pricing, and order tracking for
                verified retailers across Canada. Bulk pricing, streamlined
                logistics, and analytics&mdash;all in one platform.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  Get Started <ArrowRight size={16} />
                </Link>
                <Link href="/login" className="btn-secondary inline-block">
                  Existing Users
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t border-border bg-muted/40 py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-xl mb-16">
              <h3 className="text-3xl font-semibold text-foreground mb-3">
                Platform Features
              </h3>
              <p className="text-muted-foreground">
                Everything a distributor and their retailers need, in one place.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Zap,
                  title: "Quick Reorder",
                  desc: 'Reorder in 3 clicks with "Buy it Again" from your last invoices',
                },
                {
                  icon: Lock,
                  title: "Verified Access",
                  desc: "Secure authentication restricted to approved retailers",
                },
                {
                  icon: BarChart3,
                  title: "Live Inventory",
                  desc: "Real-time stock status with green/yellow/red indicators",
                },
              ].map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div key={idx} className="card transition-shadow hover:shadow-md">
                    <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                      <Icon className="text-primary" size={22} />
                    </div>
                    <h4 className="text-base font-semibold mb-2">{feature.title}</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* For Retailers Section */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                  <LayoutDashboard className="text-primary" size={22} />
                </div>
                <h3 className="text-3xl font-semibold text-foreground mb-6">
                  For Retailers
                </h3>
                <ul className="space-y-3.5">
                  {[
                    "Browse pricing instantly",
                    "Track orders in real-time",
                    "Access tiered discounts automatically",
                    "Manage bulk orders effortlessly",
                  ].map((item, idx) => (
                    <li key={idx} className="flex gap-3 items-start">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">
                        ✓
                      </span>
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card h-80 flex items-center justify-center bg-gradient-to-br from-primary/5 to-transparent">
                <p className="text-muted-foreground text-sm">Retailer Dashboard Preview</p>
              </div>
            </div>
          </div>
        </section>

        {/* For Admins Section */}
        <section className="border-t border-border bg-muted/40 py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="card h-80 flex items-center justify-center order-2 md:order-1 bg-gradient-to-br from-primary/5 to-transparent">
                <p className="text-muted-foreground text-sm">Admin Dashboard Preview</p>
              </div>
              <div className="order-1 md:order-2">
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                  <ShieldCheck className="text-primary" size={22} />
                </div>
                <h3 className="text-3xl font-semibold text-foreground mb-6">
                  For Admins
                </h3>
                <ul className="space-y-3.5">
                  {[
                    "Manage inventory and pricing",
                    "Process orders from central queue",
                    "Track sales & revenue trends",
                    "Approve store accounts & credit limits",
                  ].map((item, idx) => (
                    <li key={idx} className="flex gap-3 items-start">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">
                        ✓
                      </span>
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="rounded-2xl bg-zinc-950 text-white px-8 py-16 text-center relative overflow-hidden">
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(500px circle at 50% 0%, color-mix(in srgb, var(--primary) 25%, transparent), transparent 70%)",
                }}
              />
              <div className="relative">
                <h3 className="text-3xl font-semibold mb-4 text-white">
                  Ready to transform your operations?
                </h3>
                <p className="text-lg mb-8 text-zinc-300 max-w-xl mx-auto">
                  Join verified retailers across Canada managing their orders
                  efficiently.
                </p>
                <Link href="/register" className="btn-primary inline-flex items-center gap-2">
                  Sign Up Now <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xs">
                  T
                </div>
                <span className="font-semibold text-foreground">Teetoz</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Centralized ordering and inventory management for Indian food
                distribution across Canada.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4 text-sm">Product</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-primary">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4 text-sm">Company</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-primary">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4 text-sm">Support</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-primary">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary">
                    Contact Sales
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-center text-sm text-muted-foreground">
            <p>&copy; 2025 Teetoz. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
