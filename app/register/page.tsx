import Link from "next/link"
import { ArrowRight, Building2, ShieldCheck } from "lucide-react"

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-lg">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold bg-gradient-to-br from-teal-700 to-indigo-500">
            P
          </div>
          <span className="text-xl font-semibold tracking-tight text-foreground">Pallet</span>
        </Link>

        <div className="card p-8 sm:p-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Accounts are invitation-only</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Each wholesale brand has a private, isolated workspace. Brand owners create access for their own staff and retailer customers, so every account starts in the correct business environment.
          </p>

          <div className="mt-7 grid gap-3 text-left">
            <div className="flex gap-3 rounded-xl border border-border bg-muted/30 p-4">
              <Building2 className="mt-0.5 shrink-0 text-primary" size={20} />
              <div>
                <p className="font-semibold text-foreground">Wholesale brands</p>
                <p className="text-sm text-muted-foreground">Contact us and we’ll create your private Pallet workspace.</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-border bg-muted/30 p-4">
              <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={20} />
              <div>
                <p className="font-semibold text-foreground">Retailers and staff</p>
                <p className="text-sm text-muted-foreground">Ask your wholesale brand administrator to issue your login.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a
              href="mailto:business@bitsolventures.com?subject=Pallet%20workspace%20request"
              className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
            >
              Request a workspace <ArrowRight size={17} />
            </a>
            <Link href="/login" className="btn-secondary flex-1 inline-flex items-center justify-center">
              I already have a login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
