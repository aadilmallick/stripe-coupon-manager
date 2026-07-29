/**
 * In-app docs page: "Public API".
 *
 * Walks an external developer through calling `POST /api/discount-codes`
 * end-to-end: auth, request shape, response shape, error envelopes, and
 * three concrete examples (cURL, Node fetch, Stripe Checkout SDK).
 *
 * Page content is intentionally kept in lockstep with the README "Public
 * REST API" section so any change to the contract on one side should be
 * mirrored here.
 */
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen, Code2, KeyRound, ShieldCheck, Terminal } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

export const Route = createFileRoute('/docs')({
  component: PublicApiDocsPage,
})

function PublicApiDocsPage() {
  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <div className="flex flex-col gap-3">
        <span className="island-kicker">Public API · Docs</span>
        <h1 className="display-title text-4xl font-bold tracking-tight">
          Read published snapshots from your apps.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-[var(--sea-ink-soft)]">
          Every workspace's latest coupons are mirrored to Netlify Blobs after
          every Refresh. This page shows you how to pull them from an external
          app via the public REST endpoint.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="success">Read-only</Badge>
          <Badge variant="test">Token-bound</Badge>
          <Badge variant="live">Snapshots-only</Badge>
        </div>
      </div>

      {/* Auth */}
      <Card className="p-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-[var(--lagoon-deep)]" />
            Authentication
          </CardTitle>
          <CardDescription>
            Every request carries an API token you mint in
            <Link to="/settings" className="ml-1 underline-offset-2 hover:underline">
              Settings → API tokens
            </Link>
            . The plaintext is shown exactly once at creation and is SHA-256
            hashed on the server — revoking takes effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-[var(--sea-ink-soft)]">
            Either of these headers works — pick whichever fits your client:
          </p>
          <CodeBlock
            language="http"
            code={`X-API-Key: dcm_…\n# — or —\nAuthorization: Bearer dcm_…`}
          />
          <p className="text-xs text-[var(--sea-ink-soft)]">
            Tokens are bound to the workspace that minted them. A stolen token
            can only read that one workspace; the server returns{' '}
            <code className="font-mono">403 forbidden</code> for any other.
          </p>
        </CardContent>
      </Card>

      {/* Endpoint */}
      <Card className="p-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="size-5 text-[var(--lagoon-deep)]" />
            Endpoint
          </CardTitle>
          <CardDescription>
            A single POST endpoint. Reads only from Netlify Blobs, never from
            Stripe — Stripe secret keys stay in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CodeBlock language="http" code={`POST /api/discount-codes\nContent-Type: application/json`} />
          <p className="text-sm font-semibold text-[var(--sea-ink)]">Request body</p>
          <CodeBlock
            language="json"
            code={`{\n  "workspaceId": "ws_…",\n  "environment": "test" | "live"\n}`}
          />
          <p className="text-sm font-semibold text-[var(--sea-ink)]">
            Successful response · 200
          </p>
          <CodeBlock
            language="json"
            code={`{
  "workspaceId": "ws_…",
  "workspaceName": "My SaaS",
  "environment": "test",
  "fetchedAt": "2025-01-01T00:00:00.000Z",
  "publishedAt": "2025-01-01T00:00:05.123Z",
  "coupons": [
    {
      "id": "promo_…",
      "couponId": "co_…",
      "code": "SUMMER25",
      "name": "Summer 25% off",
      "discount": { "type": "percent", "percentOff": 25, "currency": null },
      "duration": "once",
      "durationMonths": null,
      "maxRedemptions": 100,
      "timesRedeemed": 12,
      "redeemBy": null,
      "active": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "stripe": {
        "checkout_integration": {
          "discounts": [{ "promotion_code": "promo_…" }]
        }
      }
    }
  ]
}`}
          />
          <p className="text-sm font-semibold text-[var(--sea-ink)]">Errors</p>
          <CodeBlock
            language="json"
            code={`{ "error": "invalid_body",  "message": "…", "status": 400 }
{ "error": "unauthorized",  "message": "…", "status": 401 }
{ "error": "forbidden",     "message": "…", "status": 403 }
{ "error": "not_published", "message": "…", "status": 404 }`}
          />
          <ul className="ml-4 list-disc space-y-1 text-sm text-[var(--sea-ink-soft)]">
            <li>
              <code className="font-mono">400 invalid_body</code> — body is
              missing <code className="font-mono">workspaceId</code> /{' '}
              <code className="font-mono">environment</code> or JSON is
              malformed.
            </li>
            <li>
              <code className="font-mono">401 unauthorized</code> —{' '}
              <code className="font-mono">X-API-Key</code> /{' '}
              <code className="font-mono">Authorization: Bearer</code> is
              missing, unknown, or revoked.
            </li>
            <li>
              <code className="font-mono">403 forbidden</code> — Token is
              bound to a different workspace than the one requested.
            </li>
            <li>
              <code className="font-mono">404 not_published</code> — No
              snapshot for this (workspaceId, environment). Refresh the
              workspace in the manager app first.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* cURL */}
      <Card className="p-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="size-5 text-[var(--lagoon-deep)]" />
            Example · cURL
          </CardTitle>
          <CardDescription>
            The shortest possible request — useful for smoke-testing or a
            quick curl in CI.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CodeBlock
            language="bash"
            code={`curl -X POST https://<your-site>/api/discount-codes \\
  -H "X-API-Key: dcm_…" \\
  -H "Content-Type: application/json" \\
  -d '{"workspaceId":"ws_…","environment":"test"}'`}
          />
        </CardContent>
      </Card>

      {/* Node fetch */}
      <Card className="p-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="size-5 text-[var(--lagoon-deep)]" />
            Example · Node (fetch)
          </CardTitle>
          <CardDescription>
            Minimal — no SDK required. Works in any modern Node 20+ or
            Edge runtime.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CodeBlock
            language="ts"
            code={`const MANAGER_API_KEY     = process.env.MANAGER_API_KEY!
const MANAGER_WORKSPACE_ID = process.env.MANAGER_WORKSPACE_ID!

async function getSnapshot(environment: 'test' | 'live') {
  const res = await fetch('https://<your-site>/api/discount-codes', {
    method: 'POST',
    headers: {
      'X-API-Key': MANAGER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workspaceId: MANAGER_WORKSPACE_ID, environment }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(\`Manager API: \${res.status} \${body?.error ?? res.statusText}\`)
  }
  return (await res.json()) as Snapshot
}`}
          />
        </CardContent>
      </Card>

      {/* Stripe Checkout */}
      <Card className="p-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-[var(--lagoon-deep)]" />
            Example · Stripe Checkout
          </CardTitle>
          <CardDescription>
            Each coupon carries a <code className="font-mono">stripe.checkout_integration</code>
            block shaped exactly like Stripe's{' '}
            <code className="font-mono">discounts[]</code> parameter. Lift it
            straight into <code className="font-mono">stripe.checkout.sessions.create</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CodeBlock
            language="ts"
            code={`import Stripe from 'stripe'
import type { Snapshot, SnapshotCoupon } from './types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
})

async function createCheckoutForPromo(args: {
  snapshot: Snapshot
  promoCode: string
  customerEmail?: string
}) {
  const match = args.snapshot.coupons.find(
    (c) => c.code === args.promoCode && c.active,
  )
  if (!match) {
    throw new Error(\`Promo "\${args.promoCode}" not found or inactive\`)
  }

  const expiresAt = match.redeemBy
    ? Math.floor(new Date(match.redeemBy).getTime() / 1000)
    : undefined

  return stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: 'price_…', quantity: 1 }],
    customer_email: args.customerEmail,
    discounts: match.stripe.checkout_integration.discounts,
    ...(expiresAt ? { expires_at: expiresAt } : {}),
    success_url: 'https://example.com/checkout/success',
    cancel_url: 'https://example.com/checkout/cancel',
  })
}`}
          />
        </CardContent>
      </Card>

      {/* Helpers */}
      <Card className="p-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-[var(--lagoon-deep)]" />
            Consumer helpers
          </CardTitle>
          <CardDescription>
            Tiny utilities you can copy into a consumer codebase to filter
            before applying a code. Full JSDoc + license are in the repo
            README.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CodeBlock
            language="ts"
            code={`export function isAvailable(
  coupon: SnapshotCoupon,
  now: Date = new Date(),
): boolean {
  if (!coupon.active) return false
  const cap = coupon.maxRedemptions
  if (cap !== undefined && coupon.timesRedeemed >= cap) return false
  const expiresAt = coupon.redeemBy
  if (expiresAt !== null && new Date(expiresAt).getTime() <= now.getTime()) {
    return false
  }
  return true
}

export const getAvailableCoupons = (snapshot: Snapshot) =>
  snapshot.coupons.filter(isAvailable)`}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--sea-ink-soft)]">
          Don't have a token yet?
        </p>
        <Link to="/settings">
          <Button variant="default" className="gap-1.5">
            Create one in Settings
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}

interface CodeBlockProps {
  language: 'bash' | 'ts' | 'json' | 'http'
  code: string
}

function CodeBlock({ language, code }: CodeBlockProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-strong)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs uppercase tracking-wider text-[var(--sea-ink-soft)]">
        <span>{language}</span>
        <button
          type="button"
          className="rounded px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-[var(--lagoon-deep)] transition-colors hover:bg-[var(--surface-strong)]"
          onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
              navigator.clipboard.writeText(code).catch(() => {
                /* fall back to no-op */
              })
            }
          }}
        >
          copy
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-[var(--sea-ink)]">
        <code>{code}</code>
      </pre>
    </div>
  )
}
