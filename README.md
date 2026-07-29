Welcome to your new TanStack Start app!

# Getting Started

To run this application:

```bash
npm install
npm run dev
```

# Building For Production

To build this application for production:

```bash
npm run build
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`

## Linting & Formatting

This project uses [eslint](https://eslint.org/) and [prettier](https://prettier.io/) for linting and formatting. Eslint is configured using [tanstack/eslint-config](https://tanstack.com/config/latest/docs/eslint). The following scripts are available:

```bash
npm run lint
npm run format
npm run check
```

## Deploy to Netlify

This project ships with `netlify.toml` configured for a Netlify site:

1. Push this repo to GitHub
2. Visit https://app.netlify.com/start and import the repo
3. Netlify auto-detects the build (`vite build` → `dist/client`)
4. Open **Site settings → Environment variables** and add anything from `.env.example` that needs a real value in production
5. Trigger the first deploy

Server functions and API routes run on Netlify Functions. For lower-latency request handling, see Netlify Edge Functions: https://docs.netlify.com/edge-functions/overview.

---

## Public REST API

External apps can read published coupon snapshots via a single endpoint deployed as a Netlify Function:

```http
POST /api/discount-codes
```

### Authentication

The endpoint expects an API token created in **Settings → API tokens**. The plaintext token is shown exactly once at creation. Either of these headers works:

```
X-API-Key: dcm_…
Authorization: Bearer dcm_…
```

Tokens are SHA-256-hashed on the server (never stored in plaintext). Revoking a token in the manager app takes effect immediately.

### Request

```json
{
  "workspaceId": "ws_…",
  "environment": "test" | "live"
}
```

### Response — 200 OK

```json
{
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
}
```

Each coupon includes a `stripe.checkout_integration.discounts[0].promotion_code` block ready to drop straight into `stripe.checkout.sessions.create({ discounts: [...] })`.

### Stripe Checkout integration

The `stripe.checkout_integration` block is shaped exactly like Stripe Checkout's `discounts` array parameter, so a consumer app can lift it straight into a Checkout Session call.

```ts
type CheckoutIntegrationDiscount = {
  promotion_code: string
}

type CheckoutIntegration = {
  discounts: [CheckoutIntegrationDiscount] // always length 1
}

type SnapshotCoupon = {
  id: string // Stripe promotion_code id (== SnapshotCoupon['stripe'].checkout_integration.discounts[0].promotion_code)
  couponId: string // Stripe coupon id
  code: string // user-facing string, e.g. "SUMMER25"
  name: string
  discount: {
    type: 'percent' | 'amount'
    percentOff?: number // 1–100, set when type === 'percent'
    amountOff?: number // integer cents, set when type === 'amount'
    currency?: string // 3-letter lowercase ISO (per Stripe convention)
  }
  duration: 'once' | 'forever' | 'repeating'
  durationMonths?: number // only present when duration === 'repeating'
  maxRedemptions?: number // null/undefined = no cap
  timesRedeemed: number
  redeemBy: string | null // ISO timestamp or null
  active: boolean
  createdAt: string // ISO timestamp
  stripe: { checkout_integration: CheckoutIntegration }
}

type Snapshot = {
  workspaceId: string
  workspaceName: string
  environment: 'test' | 'live'
  fetchedAt: string // ISO timestamp — when the browser last refreshed from Stripe
  publishedAt: string // ISO timestamp — when this snapshot was stored
  coupons: SnapshotCoupon[] // up to 500
}
```

#### Example — create a Checkout Session that applies a promo

```ts
import Stripe from 'stripe'
import type { Snapshot, SnapshotCoupon } from './types' // wherever you define your consumer types

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
})

async function createCheckoutForPromo(args: {
  snapshot: Snapshot
  promoCode: string // e.g. "SUMMER25"
  customerEmail?: string
}) {
  const { snapshot, promoCode, customerEmail } = args

  // 1. Pick the coupon. Filter by active + existence.
  const coup = snapshot.coupons.find((c) => c.code === promoCode && c.active)
  if (!coup) {
    throw new Error(`Promo code "${promoCode}" not found or inactive`)
  }

  // 2. Translate the snapshot's `redeemBy` into Stripe's `expires_at`
  //    for the Checkout Session. Stripe expects unix seconds.
  const expiresAt = coup.redeemBy
    ? Math.floor(new Date(coup.redeemBy).getTime() / 1000)
    : undefined

  // 3. Create the session — `discounts` is taken verbatim from the
  //    snapshot so the manager app stays the source of truth.
  return stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: 'price_…', quantity: 1 }],
    customer_email: customerEmail,
    discounts: coup.stripe.checkout_integration.discounts,
    ...(expiresAt ? { expires_at: expiresAt } : {}),
    success_url: 'https://example.com/checkout/success',
    cancel_url: 'https://example.com/checkout/cancel',
  })
}
```

You can also lift the `discounts` array straight from a raw fetch:

```ts
const res = await fetch('https://<your-site>/api/discount-codes', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.MANAGER_API_KEY!,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    workspaceId: process.env.MANAGER_WORKSPACE_ID!,
    environment: 'live',
  }),
})

if (!res.ok) throw new Error(`Manager API: ${res.status} ${res.statusText}`)

const snapshot = (await res.json()) as Snapshot
const checkoutInts = snapshot.coupons
  .filter((c) => c.active && c.timesRedeemed < (c.maxRedemptions ?? Infinity))
  .map((c) => ({
    code: c.code,
    discounts: c.stripe.checkout_integration.discounts,
  }))
// Pass `checkoutInts` to wherever you build your Checkout UI.
```

#### Gotchas

- **`redeemBy` is an ISO string** in the snapshot; Stripe wants unix seconds in `expires_at`. The example above handles the conversion.
- **Currency is a 3-letter lowercase ISO** (`usd`, `eur`) when `discount.type === 'amount'`. It's absent for percent discounts.
- **`maxRedemptions` may be `undefined`** — treat "no cap" as `Infinity` if you're filtering locally.
- **Token-bound workspace**: the API enforces workspace binding server-side (403 `forbidden`) so a stolen token can't read a workspace it wasn't minted for.

#### Availability helper

A coupon is **not available** if any of these hold: `active === false`, redemption cap reached, or expired. Copy this helper into your consumer codebase to keep that check in one place:

```ts
import type { SnapshotCoupon } from './types' // wherever you declared the consumer types

/**
 * Indicates whether a coupon from the public snapshot is still redeemable.
 *
 * A coupon is considered available only when ALL of the following hold:
 *  - `active` is `true` (the underlying Stripe promotion code is on)
 *  - `timesRedeemed` is strictly less than `maxRedemptions` when the cap
 *    is set
 *  - the current time is strictly before `redeemBy` when the expiry is set
 *
 * The function never throws — it returns a boolean and is safe to call
 * inside any UI conditional.
 *
 * @param coupon - The snapshot coupon to check.
 * @param now - Override the current time. Useful for deterministic tests;
 *   defaults to `new Date()`.
 * @returns `true` if the coupon can still be redeemed, `false` otherwise.
 */
export function isAvailable(
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
```

#### Filter the snapshot

`isAvailable` is the building block — here's how you usually want to use it:

```ts
import type { Snapshot, SnapshotCoupon } from './types'

/**
 * Returns a new array of coupons that still satisfy {@link isAvailable}.
 *
 * The input `snapshot` is not mutated; the result is a fresh array.
 *
 * @param snapshot - The full snapshot returned by `/api/discount-codes`.
 * @returns A new array of coupons that are still redeemable. Empty when
 *   no coupons are available.
 */
export function getAvailableCoupons(snapshot: Snapshot): SnapshotCoupon[] {
  return snapshot.coupons.filter(isAvailable)
}
```

#### Use it before creating a Checkout Session

```ts
/**
 * Looks up the user-entered promo code in the snapshot and creates the
 * Stripe Checkout Session that applies it.
 *
 * Pass `customerEmail` to pre-fill the email field on the Checkout page.
 * The `expires_at` is converted from `redeemBy` (ISO) to the unix-seconds
 * format Stripe expects.
 *
 * @param args - The current snapshot, the user-entered promo code, and
 *   an optional pre-filled customer email.
 * @returns The created Stripe Checkout Session object.
 * @throws {Error} `"Promo \"<code>\" is inactive, capped, or expired"`
 *   when the code is not in `getAvailableCoupons(snapshot)`. The string
 *   is user-safe to render.
 * @throws {Stripe.errors.StripeError} Any error Stripe throws from
 *   `stripe.checkout.sessions.create(...)`.
 */
async function createCheckoutForPromo(args: {
  snapshot: Snapshot
  promoCode: string
  customerEmail?: string
}): Promise<unknown> {
  const match = getAvailableCoupons(args.snapshot).find(
    (c) => c.code === args.promoCode,
  )
  if (!match) {
    throw new Error(`Promo "${args.promoCode}" is inactive, capped, or expired`)
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
}
```

#### Pick the best coupon automatically

If you want the manager app to drive a "best available discount" UI (e.g. auto-apply the highest-value active promo), here is a small helper built on top of `isAvailable`:

```ts
import type { Snapshot, SnapshotCoupon } from './types'

/**
 * Returns a comparable magnitude for a coupon's discount.
 *
 * For percent discounts, returns `percentOff` (1-100). For amount
 * discounts, returns `amountOff` in integer cents. Cross-currency
 * comparisons are NOT meaningful — pre-filter by `currency` before
 * calling {@link pickBestDiscount} if your workspace mixes currencies.
 *
 * @param c - The snapshot coupon.
 * @returns The raw magnitude: percent points or minor units.
 */
function discountValue(c: SnapshotCoupon): number {
  if (c.discount.type === 'percent') return c.discount.percentOff ?? 0
  return c.discount.amountOff ?? 0
}

/**
 * Picks the highest-value active coupon in the snapshot.
 *
 * Reuses {@link isAvailable} to filter out inactive / capped / expired
 * coupons and then reduces by {@link discountValue}. Currency-blind for
 * amount discounts — pre-filter by `currency` if your workspace mixes
 * currencies.
 *
 * @param snapshot - The full snapshot from `/api/discount-codes`.
 * @returns The best available coupon, or `null` when no coupon in the
 *   snapshot passes {@link isAvailable}.
 */
export function pickBestDiscount(snapshot: Snapshot): SnapshotCoupon | null {
  const available = getAvailableCoupons(snapshot)
  if (available.length === 0) return null
  return available.reduce((best, current) =>
    discountValue(current) > discountValue(best) ? current : best,
  )
}
```

⚠️ Amount-discount comparisons are currency-blind on purpose. If your workspace mixes currencies, filter by `currency` before calling `pickBestDiscount`.

#### License & attribution

These helpers originated in the Stripe Coupon Manager (MIT). If you copy them into a downstream TypeScript library, keep this license header so the attribution travels with the code:

```ts
// SPDX-License-Identifier: MIT
//
// Helpers for working with the `/api/discount-codes` snapshot published
// by the Stripe Coupon Manager. Adapted from the manager's README.
//
// Source: https://github.com/<your-fork>/stripe-coupon-manager
// Copyright (c) <year> <copyright-holder>
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject
// to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
// BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
```

### Error envelopes

Every error response is JSON with this shape and the matching `Content-Type` + `Cache-Control: no-store` headers:

```json
{ "error": "invalid_body",    "message": "…", "status": 400 }
{ "error": "unauthorized",    "message": "…", "status": 401 }
{ "error": "forbidden",       "message": "…", "status": 403 }
{ "error": "not_published",   "message": "…", "status": 404 }
```

| Status | `error`         | When                                                                                 |
| ------ | --------------- | ------------------------------------------------------------------------------------ |
| 400    | `invalid_body`  | Body is missing `workspaceId` / `environment`, or JSON is malformed                  |
| 401    | `unauthorized`  | `X-API-Key` / `Authorization: Bearer` missing, unknown, or revoked                   |
| 403    | `forbidden`     | Token is bound to a different workspace than the one requested                       |
| 404    | `not_published` | No snapshot for this `(workspaceId, environment)` — refresh in the manager app first |

### Example cURL

```bash
curl -X POST https://<your-site>/api/discount-codes \
  -H "X-API-Key: dcm_…" \
  -H "Content-Type: application/json" \
  -d '{"workspaceId":"ws_…","environment":"test"}'
```

### How snapshots get there

1. You click **Refresh** in the manager app.
2. The browser fetches from Stripe (keys never leave your device).
3. The browser mirrors a copy to **Netlify Blobs** via a TanStack Start server function.
4. External apps read from Blobs via `POST /api/discount-codes`.

The Stripe secret key never reaches Netlify — the public function only knows what an external app needs (codes, durations, redemption limits, the `stripe.checkout_integration` block).

---

## Managing API tokens

API tokens are the **client-side credentials you hand to consumer apps** so they can call `POST /api/discount-codes` from their own backend. They're read-only, scoped to one workspace + environment, and shown to you **plaintext exactly once** — the server only stores their SHA-256 hash.

### Generate a strong admin secret

You'll enter the same value in two places (Netlify **and** the in-app Settings card). Make it strong, because anyone who has it can issue or revoke tokens for your project.

```bash
openssl rand -hex 32     # → 64-char hex string, e.g. 9f0c…a4dd
```

Save this value somewhere safe (1Password, Bitwarden, etc.). You'll paste it in the next two steps.

### Wire it up end-to-end

There are **two** places the secret has to be entered and the values must be **byte-identical** (server-side Netlify env + client-side IndexedDB):

1. **Netlify (server)**
   - Open your site in the Netlify dashboard.
   - **Site settings → Environment variables → Add a variable**.
   - Key: `ADMIN_PUBLISH_SECRET`.
   - Value: paste the hex string from step above.
   - Scope: **All scopes** (or at minimum `Production`; add `Deploy previews` if you want it on PR builds).
   - **Trigger a deploy** (or wait for the next one) — env vars only take effect after a fresh deploy.

2. **Manager app (this device)**
   - Open the app → **Settings → Public API admin secret**.
   - Paste the **same** hex string into the input.
   - Click **Save** (it lives in this browser's IndexedDB).

3. **Issue a token**
   - Still in **Settings**, scroll to **API tokens**.
   - Pick the workspace (the token will be scoped to that workspace) and a human-readable name (e.g. `acme-staging-readonly`).
   - Click **Create token** → a `dcm_…` plaintext string is shown one time. Copy it now; it is **never displayed again**.

4. **Hand it to the consumer**
   - Send the `dcm_…` token to the developer integrating your coupons. They send it back on every `POST /api/discount-codes` call as either the `X-API-Key: dcm_…` header or `Authorization: Bearer dcm_…`.

### Why am I getting `Unauthorized.` (401)?

The server validates the in-browser secret before doing anything else. The two most common causes, in order:

| Symptom in the toast / server log                           | Cause                                                                                                                                                                        | Fix                                                                                                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **`ADMIN_PUBLISH_SECRET is not configured on the server…`** | The Netlify env var is missing on the deployed build.                                                                                                                        | Add it in **Netlify → Site settings → Environment variables** and **redeploy**.                                                          |
| **`Unauthorized.`**                                         | The secret in **Settings → Public API admin secret** does not byte-match the Netlify env var (typo, whitespace, different value, or you changed one side and not the other). | Re-paste the **exact** Netlify value into the Settings card. If you just changed the Netlify value, redeploy _and_ re-enter in Settings. |
| Still unauthorized after both fixes                         | Browser cached an old service worker / hard refresh needed, _or_ you're hitting `staging.netlify.app` while your Deploy-preview scope doesn't include the env var.           | Hard refresh (Cmd/Ctrl+Shift+R); add `Deploy previews` to the env var's scope if needed.                                                 |

Sanity-check the two sides match without disclosing the value:

```bash
# In the Netlify dashboard, copy the env var into your clipboard, then:
pbpaste | head -c 8   # macOS  — shows first 8 chars
xclip -o | head -c 8  # Linux
```

Compare against the first 8 chars your team put in Settings (only share the prefix, not the whole secret). If they line up, the values are the same.

### Token lifecycle

- **Revoke** at any time in **Settings → API tokens** → **Revoke**. The plaintext stops being accepted at `/api/discount-codes` within one request (server re-reads the blob store).
- **Re-issue** by creating a new token; old plaintexts keep working until you revoke them.
- **Rotate periodically** (e.g. quarterly) — revoke + re-issue + update the consumer. There's no auto-expiry, so discipline is on you.

---

## Environment Variables

All env vars below are **server-only** (no `VITE_` prefix). They are read inside TanStack Start server functions / Netlify Functions and **never** bundled into the browser — so it's safe to put real secrets here. Set them under **Site settings → Environment variables** in the Netlify dashboard, then redeploy.

| Variable               | Required for                                | Notes                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_PUBLISH_SECRET` | Public API token mgmt + snapshot publishing | Strong random string. The **same** value is entered locally in **Settings → Public API admin secret** so the in-browser RPCs match. Generate with `openssl rand -hex 32`. See [Managing API tokens](#managing-api-tokens). |
| `RESEND_API_KEY`       | Email dispatch                              | Resend API key.                                                                                                                                                                                                            |
| `RESEND_SENDER_DOMAIN` | Email dispatch                              | Bare domain (`mail.example.com`) or full address (`noreply@example.com`).                                                                                                                                                  |

Behavior when env vars are missing:

- `ADMIN_PUBLISH_SECRET` missing → admin RPCs return `ADMIN_PUBLISH_SECRET is not configured on the server…` and the **Public API admin secret** card in Settings shows setup help. The public `/api/discount-codes` endpoint still works (it only needs API tokens + snapshots).
- `RESEND_*` missing → the email dialog renders an inline configuration note and offers a `mailto:` fallback instead of failing.

A working `.env.example` lives at the repo root — copy it to `.env` for local development, but **don't** commit `.env`.

---

## Shadcn

Add components using the latest version of [Shadcn](https://ui.shadcn.com/).

```bash
pnpm dlx shadcn@latest add button
```

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from '@tanstack/react-router'
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')

  useEffect(() => {
    getServerTime().then(setTime)
  }, [])

  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

---

## Tests

The project ships with a Vitest suite that exercises the server-side token + snapshot machinery end-to-end with stubbed Netlify Blobs.

```bash
npm test           # one-shot run
npm run test:watch # watch mode
```

### Suites

| File                                    | What it covers                                                                                                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/api/discount-codes.test.ts` | Public endpoint: header parsing (X-API-Key + Bearer), Zod body validation, 401/403/404 envelopes, snapshot round-trip                                                                                      |
| `src/server/admin-rpcs.test.ts`         | Admin RPCs: `requireAdminSecret`, `createApiTokenHandler`, `revokeApiTokenHandler`, `listApiTokensHandler`, `publishCouponSnapshotHandler` — covers auth, Zod validation, token shape, and snapshot keying |

Both suites stub the `JsonStore` layer with `vi.mock` + `vi.hoisted` so they don't touch `NETLIFY_BLOBS_CONTEXT` and don't need a Netlify runtime. `sha256Hex` stays real so the hashing round-trip is exercised.

### Adding a test

Co-locate a `*.test.ts` next to the file under test, mock `#/server/storage` with stubbed maps, then drive the handler directly. Run `npm test` to verify. `npm run generate-routes` (the TanStack Router CLI) ignores `*.test.ts`, so route types stay clean.

### CI

Consider a guard step like:

```bash
npm test && npm run generate-routes && npx tsc --noEmit
```

This catches: test regressions, accidental route registration of a test file, and type drift across the suite.

---

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
