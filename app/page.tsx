"use client";

import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Users,
  Wallet,
  BarChart3,
  ShieldCheck,
  Building2,
  Check,
  Sparkles,
  Search,
  Bell,
  TrendingUp,
} from "lucide-react";

function BrowserChrome({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden w-full">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/60">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 flex justify-center">
          <span className="text-[11px] text-muted-foreground bg-background border border-border rounded-full px-3 py-0.5">
            pallet.app/{label}
          </span>
        </div>
      </div>
      <div className="p-4 sm:p-5 bg-background">{children}</div>
    </div>
  );
}

function AdminMockup() {
  const bars = [40, 65, 50, 80, 60, 95, 70];
  const orders = [
    { id: "ORD-0192", store: "Village Bakers", status: "confirmed" },
    { id: "ORD-0191", store: "Northside Grocer", status: "pending" },
    { id: "ORD-0190", store: "Corner Market", status: "confirmed" },
  ];
  return (
    <BrowserChrome label="admin/dashboard">
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Revenue", value: "$12,480" },
          { label: "Orders", value: "34" },
          { label: "Stores", value: "18" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border p-3">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{s.label}</p>
            <p className="text-lg font-semibold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border p-3 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-foreground">Sales this week</p>
          <TrendingUp size={14} className="text-primary" />
        </div>
        <div className="flex items-end gap-2 h-16">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t"
              style={{
                height: `${h}%`,
                background: "linear-gradient(180deg, #0f766e, color-mix(in srgb, #0f766e 40%, transparent))",
              }}
            />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        {orders.map((o, i) => (
          <div
            key={o.id}
            className={`flex items-center justify-between px-3 py-2.5 text-xs ${i !== orders.length - 1 ? "border-b border-border" : ""}`}
          >
            <span className="font-medium text-foreground">{o.id}</span>
            <span className="text-muted-foreground">{o.store}</span>
            <span className={`status-badge ${o.status === "confirmed" ? "status-green" : "status-yellow"}`}>
              {o.status}
            </span>
          </div>
        ))}
      </div>
    </BrowserChrome>
  );
}

function RetailerMockup() {
  const products = [
    { name: "Basmati Rice 20kg", price: "$34.00", tone: "#0f766e" },
    { name: "Chana Dal 10kg", price: "$18.50", tone: "#6366f1" },
    { name: "Sunflower Oil 5L", price: "$12.00", tone: "#d97706" },
    { name: "Whole Wheat Flour 25kg", price: "$22.75", tone: "#0ea5e9" },
  ];
  return (
    <BrowserChrome label="retailer/catalog">
      <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 mb-4 text-xs text-muted-foreground">
        <Search size={13} />
        Search products...
        <Bell size={13} className="ml-auto text-muted-foreground" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => (
          <div key={p.name} className="rounded-lg border border-border p-3">
            <div
              className="w-full h-12 rounded-md mb-2.5"
              style={{ background: `color-mix(in srgb, ${p.tone} 18%, transparent)` }}
            />
            <p className="text-xs font-medium text-foreground leading-tight mb-1">{p.name}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">{p.price}</span>
              <span className="status-badge status-green text-[10px]">in stock</span>
            </div>
          </div>
        ))}
      </div>
    </BrowserChrome>
  );
}

const CONTACT_EMAIL = "kashifabro831@gmail.com";
const DEMO_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  "I want to bring my wholesale brand onto Pallet"
)}&body=${encodeURIComponent(
  "Hey — tell me a bit about your business:\n\nBrand name:\nWhat you distribute:\nRoughly how many retailer customers:\n\n"
)}`;

const features = [
  {
    icon: Boxes,
    title: "Inventory that never lies",
    desc: "Live stock levels, low-stock alerts, and full transaction history — no more guessing what's actually on the shelf.",
  },
  {
    icon: BarChart3,
    title: "Orders & sales, tracked automatically",
    desc: "Every order, invoice, and dollar flows into one dashboard. Best-sellers, slow movers, and trends surface themselves.",
  },
  {
    icon: Wallet,
    title: "Customer credit & dues, sorted",
    desc: "Give retailers credit, track what they owe, and stop chasing payments through a group chat.",
  },
  {
    icon: Users,
    title: "Staff & payroll in the same place",
    desc: "Add your team, track pay periods, and keep HR out of a separate spreadsheet nobody updates.",
  },
  {
    icon: ShieldCheck,
    title: "Your data, only yours",
    desc: "Every brand on Pallet runs in a fully isolated account. No other brand — not even us — sees your inventory or customers.",
  },
  {
    icon: Building2,
    title: "Set up in a day, not a quarter",
    desc: "No IT team required. We set up your account, hand you the login, and you're taking orders the same day.",
  },
];

const forCustomers = [
  "Self-serve login for every retailer you sell to",
  "Live pricing and stock, no more phone-tag",
  "Order history and reorder in a couple clicks",
  "See exactly what they owe, no surprises",
];

const forYou = [
  "One queue for every incoming order",
  "Approve, ship, and invoice without leaving the tab",
  "Add staff and manage payroll for your team",
  "Real dashboards — not a spreadsheet someone forgot to update",
];

export default function LandingPage() {
  return (
    <>
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "linear-gradient(135deg, #0f766e, #6366f1)" }}
            >
              P
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">Pallet</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost">
              Login
            </Link>
            <a href={DEMO_MAILTO} className="btn-primary">
              Book a Demo
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-background py-28 sm:py-36">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(700px circle at 10% 10%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 60%), radial-gradient(600px circle at 90% 30%, color-mix(in srgb, #6366f1 12%, transparent), transparent 55%)",
            }}
          />
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground mb-6">
                  <Sparkles size={13} className="text-primary" />
                  Built for wholesale brands across Canada
                </div>
                <h1 className="text-5xl font-semibold text-foreground mb-6 text-balance leading-[1.05] tracking-tight">
                  Run your wholesale business on one dashboard,
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(135deg, #0f766e, #6366f1)" }}
                  >
                    {" "}not five spreadsheets
                  </span>
                </h1>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-xl">
                  Pallet gives your wholesale brand its own private inventory,
                  order, customer, and staff platform — fully isolated from
                  every other brand we work with. Set up in a day, not a
                  quarter.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a href={DEMO_MAILTO} className="btn-primary inline-flex items-center gap-2">
                    Book a Demo <ArrowRight size={16} />
                  </a>
                  <Link href="/login" className="btn-secondary inline-block">
                    Existing Users
                  </Link>
                </div>
              </div>

              <div className="relative">
                <div
                  className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] opacity-60"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--primary) 20%, transparent), transparent 60%)",
                  }}
                />
                <AdminMockup />
              </div>
            </div>

            <div className="mt-16 flex flex-wrap gap-x-10 gap-y-4 text-sm text-muted-foreground">
              <div>
                <span className="text-2xl font-semibold text-foreground">127+</span>{" "}
                retailer stores already ordering through Pallet
              </div>
              <div>
                <span className="text-2xl font-semibold text-foreground">100%</span>{" "}
                isolated — your data never touches another brand's account
              </div>
              <div>
                <span className="text-2xl font-semibold text-foreground">1 day</span>{" "}
                typical time from signup to your first order
              </div>
            </div>
          </div>
        </section>

        {/* Problem/Solution */}
        <section className="border-t border-border bg-muted/40 py-24">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-semibold text-foreground mb-4">
                Still tracking who owes you money in a notes app?
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Most wholesale distributors run on some combination of a
                spreadsheet, a group chat, and a part-time bookkeeper. It
                works — until an order gets missed, a payment goes untracked,
                or the one person who understands the system takes a week
                off.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Pallet replaces all of it with one system built specifically
                for how wholesale actually runs: bulk orders, retailer
                credit, and inventory that moves in cases, not units.
              </p>
            </div>
            <div className="card p-8 bg-card">
              <p className="text-sm font-semibold text-foreground mb-5">What you get on day one</p>
              <ul className="space-y-3">
                {["Your own private brand account", "Login for every staff member you add", "Login for every retailer customer you add", "Real-time dashboards from your very first order"].map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-xl mb-16">
              <h2 className="text-3xl font-semibold text-foreground mb-3">
                Everything a wholesale brand actually needs
              </h2>
              <p className="text-muted-foreground">
                Not a generic inventory tool with wholesale bolted on — built around how distributors really work.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div key={idx} className="card transition-shadow hover:shadow-md">
                    <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                      <Icon className="text-primary" size={22} />
                    </div>
                    <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* For You / For Your Customers */}
        <section className="border-t border-border bg-muted/40 py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-20">
              <div>
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                  <ShieldCheck className="text-primary" size={22} />
                </div>
                <h3 className="text-3xl font-semibold text-foreground mb-6">For you and your team</h3>
                <ul className="space-y-3.5">
                  {forYou.map((item) => (
                    <li key={item} className="flex gap-3 items-start">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <AdminMockup />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1">
                <RetailerMockup />
              </div>
              <div className="order-1 md:order-2">
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                  <Users className="text-primary" size={22} />
                </div>
                <h3 className="text-3xl font-semibold text-foreground mb-6">For your customers</h3>
                <ul className="space-y-3.5">
                  {forCustomers.map((item) => (
                    <li key={item} className="flex gap-3 items-start">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Case Study */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="card p-10 sm:p-14 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground mb-5">
                    <Building2 size={13} className="text-primary" />
                    First brand on Pallet
                  </div>
                  <h2 className="text-3xl font-semibold text-foreground mb-4">Teetoz runs entirely on Pallet</h2>
                  <p className="text-muted-foreground leading-relaxed max-w-lg">
                    Teetoz, a wholesale Indian food distributor across Canada, uses Pallet
                    for its full retailer network — inventory, orders, and store accounts,
                    all in one dashboard.
                  </p>
                </div>
                <div className="flex gap-8 md:gap-10 md:pl-10 md:border-l border-border">
                  <div>
                    <p className="text-3xl font-semibold text-foreground">127</p>
                    <p className="text-sm text-muted-foreground mt-1">retailer stores</p>
                  </div>
                  <div>
                    <p className="text-3xl font-semibold text-foreground">60</p>
                    <p className="text-sm text-muted-foreground mt-1">products live</p>
                  </div>
                </div>
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
                    "radial-gradient(500px circle at 20% 0%, color-mix(in srgb, var(--primary) 30%, transparent), transparent 70%), radial-gradient(500px circle at 80% 100%, color-mix(in srgb, #6366f1 25%, transparent), transparent 70%)",
                }}
              />
              <div className="relative">
                <h2 className="text-3xl font-semibold mb-4 text-white">
                  Give your wholesale brand its own platform
                </h2>
                <p className="text-lg mb-8 text-zinc-300 max-w-xl mx-auto">
                  We'll set up your account, add your first products, and hand you the login — no technical work on your end.
                </p>
                <a href={DEMO_MAILTO} className="btn-primary inline-flex items-center gap-2">
                  Book a Demo <ArrowRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                  style={{ background: "linear-gradient(135deg, #0f766e, #6366f1)" }}
                >
                  P
                </div>
                <span className="font-semibold text-foreground">Pallet</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                The dedicated inventory, order, and staff platform for wholesale brands across Canada.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4 text-sm">Product</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>
                  <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-primary cursor-default">
                    Features
                  </a>
                </li>
                <li>
                  <a href={DEMO_MAILTO} className="hover:text-primary">
                    Book a Demo
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4 text-sm">Contact</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>
                  <a href={DEMO_MAILTO} className="hover:text-primary">
                    {CONTACT_EMAIL}
                  </a>
                </li>
                <li>
                  <Link href="/login" className="hover:text-primary">
                    Existing user login
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>&copy; 2026 Pallet. All rights reserved.</p>
            <p>
              Powered by{" "}
              <a
                href="https://bitsolventures.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:text-primary"
              >
                BS Ventures (Pvt) Ltd
              </a>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
