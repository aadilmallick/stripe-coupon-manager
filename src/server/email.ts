/**
 * Server function that sends discount codes by email using Resend.
 *
 * Reads server-side env vars:
 *   - RESEND_API_KEY       (required for delivery)
 *   - RESEND_SENDER_DOMAIN (required for the From address, e.g. "noreply@myapp.com")
 *
 * If either is missing, returns `ok: false, reason: 'no-resend-config'` so the
 * client can fall back to a mailto: link.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { Resend } from 'resend'
import { renderHtml, renderPlaintext, type ShareItem } from '#/lib/email-template'

const ItemSchema = z.object({
  code: z.string(),
  name: z.string(),
  discountType: z.enum(['percent', 'amount']),
  percentOff: z.number().optional(),
  amountOff: z.number().optional(),
  currency: z.string().optional(),
  duration: z.enum(['once', 'forever', 'repeating']),
  durationMonths: z.number().optional(),
  maxRedemptions: z.number().optional(),
  timesRedeemed: z.number(),
  active: z.boolean(),
  environment: z.enum(['test', 'live']),
})

const SendPayloadSchema = z.object({
  to: z.string().email(),
  recipientName: z.string().optional(),
  workspaceName: z.string().min(1).max(80),
  workspaceDescription: z.string().max(280).optional(),
  note: z.string().max(2000).optional(),
  items: z.array(ItemSchema).max(200),
  subjectOverride: z.string().min(1).max(120).optional(),
})

export type SendDiscountCodesEmailPayload = z.infer<typeof SendPayloadSchema>

interface SendEmailResult {
  ok: boolean
  provider: 'resend' | 'none'
  mode?: 'live' | 'test'
  resendId?: string
  error?: string
  reason?: 'no-resend-config' | 'resend-error' | 'invalid-payload'
}

/**
 * Server-only send helper. Mirrors the shape of the user's snippet:
 *   `sendMail(resend, { to, from, fromTitle, subject, htmlContent })`
 * returning an error or null.
 */
async function sendMail(args: {
  resend: Resend
  to: string
  from: string
  fromTitle: string
  subject: string
  htmlContent: string
  textContent: string
}): Promise<Error | null> {
  try {
    const { error } = await args.resend.emails.send({
      from: `${args.fromTitle} <${args.from}>`,
      to: args.to,
      subject: args.subject,
      html: args.htmlContent,
      text: args.textContent,
    })
    return error ?? null
  } catch (err) {
    console.error('[resend] email error:', err)
    return err instanceof Error ? err : new Error(String(err))
  }
}

/**
 * Mail sender title. Composed from RESEND_SENDER_DOMAIN — falls back to "noreply"
 * if the domain is bare (`example.com`) so Resend's "Name <addr@host>" shape is
 * preserved.
 */
function senderTitleFromDomain(domain: string): string {
  const local = domain.split('@')[0] ?? 'noreply'
  return local === 'noreply' || local === 'no-reply' ? 'Discount Codes' : 'Discount Codes'
}

function senderAddressFromDomain(domain: string): string {
  if (domain.includes('@')) return domain
  return `noreply@${domain}`
}

export const sendDiscountCodesEmailServerFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => SendPayloadSchema.parse(data))
  .handler(async ({ data }): Promise<SendEmailResult> => {
    const apiKey = process.env.RESEND_API_KEY?.trim()
    const domain = process.env.RESEND_SENDER_DOMAIN?.trim()

    if (!apiKey || !domain) {
      return {
        ok: false,
        provider: 'none',
        reason: 'no-resend-config',
      }
    }

    const payload = {
      workspaceName: data.workspaceName,
      workspaceDescription: data.workspaceDescription,
      recipientName: data.recipientName,
      note: data.note,
      items: data.items as ShareItem[],
    }

    const subject =
      data.subjectOverride ?? `Discount codes from ${data.workspaceName}`
    const html = renderHtml(payload)
    const text = renderPlaintext(payload)

    const resend = new Resend(apiKey)
    const fromAddress = senderAddressFromDomain(domain)
    const fromTitle = senderTitleFromDomain(domain)

    const sent = await sendMail({
      resend,
      to: data.to,
      from: fromAddress,
      fromTitle,
      subject,
      htmlContent: html,
      textContent: text,
    })

    if (sent) {
      return {
        ok: false,
        provider: 'resend',
        reason: 'resend-error',
        error: sent.message,
      }
    }
    return {
      ok: true,
      provider: 'resend',
      mode: process.env.RESENDER_FORCE_TEST === 'true' ? 'test' : 'live',
    }
  })
