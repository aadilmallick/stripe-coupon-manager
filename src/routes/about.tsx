import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Cookie, Search, Sparkles, Tag, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span className="island-kicker">About</span>
        <h1 className="display-title text-4xl font-bold tracking-tight">
          A faster home for discount codes.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-[var(--sea-ink-soft)]">
          Stripe is amazing, but managing discount codes in the Dashboard takes
          longer than it should. We built a tiny, opinionated utility focused on
          one task: getting discount codes into Stripe fast, and keeping them
          easy to scan.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Feature
          icon={<Cookie className="size-5 text-white" />}
          title="One concept, not two."
          body="Stripe exposes Coupons and Promotion Codes as separate objects. We collapse them into a single level: Discount Code."
        />
        <Feature
          icon={<Tag className="size-5 text-white" />}
          title="Opinionated defaults."
          body="USD, applies to all products, no customer restrictions. Override later if you really need to."
        />
        <Feature
          icon={<Zap className="size-5 text-white" />}
          title="Local-first."
          body="Keys never leave your browser. We make direct calls to Stripe from this device."
        />
      </div>

      <Card className="p-0">
        <CardHeader>
          <CardTitle>How the model maps</CardTitle>
          <CardDescription>
            Internally, we translate between Stripe's two resources for you.
            That mapping is the only place Stripe ever leaks in.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 font-mono text-sm">
            <div>Discount Code</div>
            <div className="ml-2">↓</div>
            <div>Stripe Coupon</div>
            <div className="ml-2">↓</div>
            <div>Stripe Promotion Code</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="test">Creation</Badge>
            <span className="text-sm text-[var(--sea-ink-soft)]">
              POST <code>/v1/coupons</code> → POST <code>/v1/promotion_codes</code>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">Listing</Badge>
            <span className="text-sm text-[var(--sea-ink-soft)]">
              GET <code>/v1/promotion_codes?expand[]=data.coupon</code>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="live">Deletion</Badge>
            <span className="text-sm text-[var(--sea-ink-soft)]">
              POST deactivate → DELETE coupon (handle "already redeemed" gracefully)
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader>
          <CardTitle>Search, copy, repeat.</CardTitle>
          <CardDescription>
            Two things the Stripe Dashboard makes you do too much of.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm leading-relaxed">
          <p className="flex items-start gap-2">
            <Search className="mt-0.5 size-4 text-[var(--lagoon-deep)]" />
            Local search by code or display name — no API roundtrip.
          </p>
          <p className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-4 text-[var(--lagoon-deep)]" />
            Click any code to copy it to your clipboard.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Link to="/settings">
          <Button variant="default" className="gap-1.5">
            Set up your first workspace
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <Card className="feature-card p-6">
      <div
        className="mb-4 inline-grid size-10 place-items-center rounded-xl shadow-[0_8px_18px_-12px_rgba(50,143,151,0.7)]"
        style={{
          background:
            'linear-gradient(135deg,var(--lagoon) 0%,var(--lagoon-deep) 60%,var(--palm) 130%)',
        }}
      >
        {icon}
      </div>
      <h3 className="display-title text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-[var(--sea-ink-soft)]">{body}</p>
    </Card>
  )
}
