"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Box, Mail, PackageCheck, Search } from "lucide-react"
import { PoweredByFooter } from "@/components/powered-by-footer"

type StorefrontData = {
  brand: { name: string; slug: string; public_description: string | null; logo_url: string | null; contact_email: string | null }
  products: { id: string; name: string; description: string | null; sku: string; unit: string; unit_quantity: number | null; image_url: string | null; stock_status: string; featured: boolean; categories: { name: string } | null }[]
}

export default function BrandStorefrontPage() {
  const params = useParams<{ slug: string }>()
  const [data, setData] = useState<StorefrontData | null>(null)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetch(`/api/public/brands/${encodeURIComponent(params.slug)}`)
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error?.message || "Storefront not found")
        setData(body.data)
      })
      .catch(err => setError(err.message))
  }, [params.slug])

  const products = useMemo(() => {
    if (!data) return []
    const term = search.trim().toLowerCase()
    if (!term) return data.products
    return data.products.filter(product =>
      `${product.name} ${product.sku} ${product.categories?.name || ""}`.toLowerCase().includes(term)
    )
  }, [data, search])

  if (error) return <div className="min-h-screen grid place-items-center bg-muted/30 px-6"><div className="text-center"><h1 className="text-3xl font-bold">Storefront unavailable</h1><p className="mt-2 text-muted-foreground">{error}</p><Link className="btn-primary inline-flex mt-6" href="/">Back to Pallet</Link></div></div>
  if (!data) return <div className="min-h-screen grid place-items-center bg-muted/30"><div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  const initial = data.brand.name.charAt(0).toUpperCase()
  return (
    <div className="min-h-screen bg-muted/25">
      <header className="border-b bg-background/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.brand.logo_url ? <img src={data.brand.logo_url} alt="" className="h-9 w-9 rounded-xl object-cover" /> : <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center font-bold">{initial}</div>}
            <span className="font-bold text-lg">{data.brand.name}</span>
          </div>
          <Link href="/login" className="btn-secondary">Customer login</Link>
        </div>
      </header>

      <main>
        <section className="border-b bg-gradient-to-br from-primary/10 via-background to-indigo-500/10">
          <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid md:grid-cols-[1fr_360px] gap-10 items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Wholesale catalog</p>
              <h1 className="mt-4 text-4xl md:text-6xl font-black tracking-tight">Stock your shelves with {data.brand.name}</h1>
              <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{data.brand.public_description || `Browse current products from ${data.brand.name}. Existing retail customers can sign in to see their pricing and place orders.`}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/login" className="btn-primary inline-flex items-center gap-2">Retailer sign in <ArrowRight size={17} /></Link>
                {data.brand.contact_email && <a href={`mailto:${data.brand.contact_email}`} className="btn-secondary inline-flex items-center gap-2"><Mail size={17} /> Become a customer</a>}
              </div>
            </div>
            <div className="rounded-3xl border bg-card p-7 shadow-xl shadow-primary/5">
              <PackageCheck className="text-primary" size={32} />
              <p className="mt-5 text-3xl font-black">{data.products.length}</p>
              <p className="text-muted-foreground">products currently listed</p>
              <p className="mt-5 border-t pt-5 text-sm text-muted-foreground">Live availability. Account-specific wholesale pricing appears after login.</p>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 py-14">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8">
            <div><p className="text-sm font-bold text-primary uppercase tracking-wider">Product catalog</p><h2 className="text-3xl font-bold mt-1">Available products</h2></div>
            <label className="relative block w-full md:w-80"><Search className="absolute left-3 top-3 text-muted-foreground" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} className="input w-full pl-10" placeholder="Search name, SKU or category" /></label>
          </div>

          {products.length === 0 ? (
            <div className="card py-16 text-center"><Box className="mx-auto text-muted-foreground" size={36} /><p className="mt-3 font-semibold">No matching products</p></div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {products.map(product => (
                <article key={product.id} className="card overflow-hidden p-0 hover:-translate-y-1 transition-transform">
                  <div className="aspect-[4/3] bg-muted grid place-items-center overflow-hidden">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <Box className="text-muted-foreground/40" size={42} />}</div>
                  <div className="p-5">
                    <div className="flex justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wider text-primary">{product.categories?.name || "Product"}</p><span className="text-xs text-muted-foreground">{product.sku}</span></div>
                    <h3 className="mt-2 text-lg font-bold">{product.name}</h3>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{product.description || `${product.unit_quantity || ""} ${product.unit}`.trim()}</p>
                    <p className={`mt-4 text-xs font-bold ${product.stock_status === "out_of_stock" ? "text-rose-600" : "text-emerald-600"}`}>{product.stock_status === "out_of_stock" ? "Currently unavailable" : "Available to order"}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <PoweredByFooter />
    </div>
  )
}
