/**
 * Plain text + HTML rendering for the "share discount codes" email.
 *
 * Runs server-side inside the Netlify cloud function (see `src/server/email.ts`).
 * Dependency-free so the renderer doesn't leak Stripe specifics into the
 * client bundle.
 */
import type {
  DiscountCode,
  DiscountEnvironment,
} from '#/features/stripe/types/discount-code'
import {
  compactNumber,
  formatCurrency,
  formatDuration,
  formatIsoDate,
} from '#/lib/format'

export interface ShareItem {
  code: string
  name: string
  discountType: DiscountCode['discountType']
  percentOff?: number
  amountOff?: number
  currency?: string
  duration: DiscountCode['duration']
  durationMonths?: number
  maxRedemptions?: number
  timesRedeemed: number
  active: boolean
  environment: DiscountEnvironment
}

export interface SharePayload {
  workspaceName: string
  workspaceDescription?: string
  recipientName?: string
  /** Optional free-form note the sender adds in the dialog. */
  note?: string
  items: ShareItem[]
}

function renderDiscount(item: ShareItem): string {
  if (item.discountType === 'percent') {
    return item.percentOff != null ? `${item.percentOff}% off` : 'percentage off'
  }
  return formatCurrency(item.amountOff, item.currency)
}

function renderDuration(item: ShareItem): string {
  return formatDuration(item.duration, item.durationMonths)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderPlaintext(payload: SharePayload): string {
  const envs = Array.from(new Set(payload.items.map((i) => i.environment)))
  const greeting = payload.recipientName ? `Hi ${payload.recipientName},` : 'Hi,'
  const lines: string[] = []
  lines.push(greeting)
  if (payload.note?.trim()) {
    lines.push('')
    lines.push(payload.note.trim())
  }
  lines.push('')
  lines.push(
    `Here are the discount codes from "${payload.workspaceName}"${
      envs.length > 0 ? ` (${envs.join(' + ')})` : ''
    }:`,
  )
  if (payload.workspaceDescription) {
    lines.push('')
    lines.push(`Note: ${payload.workspaceDescription}`)
  }
  lines.push('')
  for (const item of payload.items) {
    const env = item.environment === 'live' ? 'LIVE' : 'TEST'
    lines.push(
      `  • [${env}] ${item.code} — ${renderDiscount(item)} · ${renderDuration(item)} · ${item.timesRedeemed}/${compactNumber(item.maxRedemptions)} redeemed${item.active ? '' : ' (inactive)'}`,
    )
  }
  lines.push('')
  lines.push(
    'Sent from the Stripe Coupon Manager. Keys stay in your browser; only the message bodies reach the server.',
  )
  return lines.join('\n')
}

export function renderHtml(payload: SharePayload): string {
  const envs = Array.from(new Set(payload.items.map((i) => i.environment)))
  const greeting = payload.recipientName
    ? `Hi ${escapeHtml(payload.recipientName)},`
    : 'Hi,'
  const groupLabel =
    envs.length === 1
      ? envs[0] === 'live'
        ? 'Live mode'
        : 'Test mode'
      : envs.length > 1
        ? 'Mixed (Test + Live)'
        : 'Discount codes'

  const rows = payload.items
    .map((item) => {
      const badgeBg = item.environment === 'live' ? '#bf2e2e' : '#2563d0'
      return `
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #e7f0e8;">
            <div style="font-family:ui-monospace,Menlo,monospace;font-size:14px;font-weight:700;color:#173a40;letter-spacing:0.02em;">${escapeHtml(item.code)}</div>
            <div style="margin-top:2px;font-size:12px;color:#416166;">${escapeHtml(item.name)}</div>
          </td>
          <td style="padding:14px 16px;border-bottom:1px solid #e7f0e8;font-weight:600;color:#173a40;">${escapeHtml(renderDiscount(item))}</td>
          <td style="padding:14px 16px;border-bottom:1px solid #e7f0e8;color:#416166;font-size:13px;">${escapeHtml(renderDuration(item))}</td>
          <td style="padding:14px 16px;border-bottom:1px solid #e7f0e8;color:#416166;font-size:13px;">${item.timesRedeemed}${item.maxRedemptions ? `/${item.maxRedemptions}` : ''}</td>
          <td style="padding:14px 16px;border-bottom:1px solid #e7f0e8;text-align:right;">
            <span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${badgeBg};color:#fff;font-size:11px;font-weight:700;letter-spacing:0.08em;">${item.environment.toUpperCase()}</span>
            ${item.active ? '' : '<span style="display:inline-block;margin-left:6px;padding:3px 8px;border-radius:999px;background:#e7f0e8;color:#416166;font-size:11px;font-weight:700;">INACTIVE</span>'}
          </td>
        </tr>`
    })
    .join('')

  const createdLine = payload.items.length
    ? `<p style="margin:6px 0 0;font-size:11px;color:#7a8a8d;">Last synced ${formatIsoDate(new Date().toISOString())}</p>`
    : ''

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f3faf5;font-family:Manrope,system-ui,sans-serif;color:#173a40;">
  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e7f0e8;border-radius:16px;overflow:hidden;box-shadow:0 1px 0 rgba(255,255,255,0.7) inset,0 18px 30px rgba(30,90,72,0.06);">
      <div style="padding:24px 28px;background:linear-gradient(135deg,#4fb8b2 0%,#328f97 60%,#2f6a4a 130%);color:#fff;">
        <div style="font-size:11px;letter-spacing:0.18em;font-weight:700;text-transform:uppercase;opacity:0.85;">${escapeHtml(groupLabel)}</div>
        <div style="margin-top:6px;font-family:Fraunces,Georgia,serif;font-size:24px;font-weight:700;">${escapeHtml(payload.workspaceName)}</div>
        ${createdLine}
      </div>
      <div style="padding:24px 28px;">
        <p style="margin:0;font-size:15px;line-height:1.55;color:#173a40;">${greeting}</p>
        ${
          payload.note?.trim()
            ? `<p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#173a40;white-space:pre-wrap;">${escapeHtml(payload.note.trim())}</p>`
            : ''
        }
        ${
          payload.workspaceDescription
            ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:#416166;border-left:3px solid #4fb8b2;padding:6px 12px;background:#f3faf5;border-radius:8px;">${escapeHtml(payload.workspaceDescription)}</p>`
            : ''
        }
        <p style="margin:14px 0 20px;font-size:14px;line-height:1.55;color:#173a40;">Here are the discount codes:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e7f0e8;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#f3faf5;">
              <th align="left" style="padding:10px 16px;font-size:11px;font-weight:700;color:#416166;text-transform:uppercase;letter-spacing:0.12em;">Code</th>
              <th align="left" style="padding:10px 16px;font-size:11px;font-weight:700;color:#416166;text-transform:uppercase;letter-spacing:0.12em;">Discount</th>
              <th align="left" style="padding:10px 16px;font-size:11px;font-weight:700;color:#416166;text-transform:uppercase;letter-spacing:0.12em;">Duration</th>
              <th align="left" style="padding:10px 16px;font-size:11px;font-weight:700;color:#416166;text-transform:uppercase;letter-spacing:0.12em;">Used</th>
              <th align="right" style="padding:10px 16px;font-size:11px;font-weight:700;color:#416166;text-transform:uppercase;letter-spacing:0.12em;">Env</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:22px 0 0;font-size:12px;color:#416166;">Sent from the Stripe Coupon Manager. Stripe keys never leave your browser.</p>
      </div>
    </div>
  </div>
</body>
</html>`
}
