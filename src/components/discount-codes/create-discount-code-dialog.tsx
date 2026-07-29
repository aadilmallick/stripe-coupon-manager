import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { cn } from '#/lib/utils'
import {
  CreateDiscountCodeFormSchema,
  type CreateDiscountCodeFormValues,
} from '#/features/stripe/schemas/discount-code'
import type { z } from 'zod'
import { useCreateDiscountCode } from '#/features/stripe/hooks/use-discount-codes'
import type { SelectedWorkspaceContext } from '#/features/stripe/hooks/use-current-selection'

type FormInput = z.input<typeof CreateDiscountCodeFormSchema>

const SAMPLE_CODE = () =>
  ['SUMMER', 'SAVE', 'WELCOME', 'VIP', 'FRIENDS'][Math.floor(Math.random() * 5)] +
  Math.floor(Math.random() * 80 + 10)

interface Props {
  open: boolean
  onOpenChange: (next: boolean) => void
  context: SelectedWorkspaceContext | null
  onCreated?: (code: string) => void
}

export function CreateDiscountCodeDialog({ open, onOpenChange, context, onCreated }: Props) {
  const create = useCreateDiscountCode(context)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormInput, unknown, CreateDiscountCodeFormValues>({
    resolver: zodResolver(CreateDiscountCodeFormSchema),
    defaultValues: {
      code: '',
      name: '',
      discountType: 'percent',
      value: '10',
      duration: 'once',
      durationMonths: undefined,
      maxRedemptions: undefined,
      redeemBy: '',
      currency: 'usd',
    } as FormInput,
    mode: 'onChange',
  })

  useEffect(() => {
    if (open) {
      form.reset({
        code: '',
        name: '',
        discountType: 'percent',
        value: '10',
        duration: 'once',
        durationMonths: undefined,
        maxRedemptions: undefined,
        redeemBy: '',
        currency: 'usd',
      } as FormInput)
    }
  }, [open, form])

  const discountType = form.watch('discountType')
  const duration = form.watch('duration')

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true)
    // Optimistically close the dialog.
    onOpenChange(false)
    try {
      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        discountType: values.discountType,
        value: Number(values.value),
        duration: values.duration,
        durationMonths:
          values.duration === 'repeating' ? Number(values.durationMonths) : undefined,
        maxRedemptions: values.maxRedemptions
          ? Number(values.maxRedemptions)
          : undefined,
        redeemBy: values.redeemBy ? new Date(values.redeemBy).toISOString() : undefined,
        currency:
          values.discountType === 'amount'
            ? values.currency || 'usd'
            : undefined,
      }
      const created = await create.mutateAsync(payload)
      toast.success(`Created "${created.code}"`)
      onCreated?.(created.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not create discount code'
      toast.error(msg, {
        description:
          err instanceof Error && /already exists|duplicate/i.test(err.message)
            ? 'Try a different code.'
            : undefined,
      })
    } finally {
      setSubmitting(false)
    }
  })

  if (!context) return null

  const currencyFieldId = 'dcc-currency'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Create discount code"
        description={`New code will appear in the ${context.workspace.name} (${context.environment}).`}
      >
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dcc-code">Discount code</Label>
              <div className="flex gap-2">
                <Input
                  id="dcc-code"
                  placeholder="SUMMER25"
                  className="flex-1 font-mono"
                  autoComplete="off"
                  autoFocus
                  {...form.register('code')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => form.setValue('code', SAMPLE_CODE(), { shouldValidate: true })}
                  aria-label="Generate sample code"
                >
                  <Wand2 className="size-4" />
                </Button>
              </div>
              {form.formState.errors.code ? (
                <p className="text-xs text-[var(--destructive)]">
                  {form.formState.errors.code.message}
                </p>
              ) : (
                <p className="text-xs text-[var(--sea-ink-soft)]">
                  Customer-facing string. Letters, digits, dashes, underscores.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Label htmlFor="dcc-name">Display name</Label>
              <Input
                id="dcc-name"
                placeholder="Summer sale"
                autoComplete="off"
                {...form.register('name')}
              />
              {form.formState.errors.name ? (
                <p className="text-xs text-[var(--destructive)]">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 pt-3">
              <Label>Discount type</Label>
              <SegmentedControl
                value={discountType}
                options={[
                  { value: 'percent', label: 'Percentage' },
                  { value: 'amount', label: 'Fixed amount' },
                ]}
                onChange={(v) =>
                  form.setValue('discountType', v as 'percent' | 'amount', { shouldValidate: true })
                }
              />
            </div>

            <div className="flex gap-2 pt-3">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="dcc-value">
                  {discountType === 'percent' ? 'Percent off' : 'Amount off'}
                </Label>
                <div className="flex items-stretch gap-2">
                  <Input
                    id="dcc-value"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step={discountType === 'percent' ? '1' : '0.01'}
                    {...form.register('value')}
                  />
                  {discountType === 'amount' ? (
                    <div className="flex items-center">
                      <select
                        id={currencyFieldId}
                        className="h-10 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 text-sm font-semibold text-[var(--sea-ink)]"
                        defaultValue="usd"
                        {...form.register('currency')}
                      >
                        <option value="usd">USD</option>
                        <option value="eur">EUR</option>
                        <option value="gbp">GBP</option>
                        <option value="cad">CAD</option>
                        <option value="aud">AUD</option>
                      </select>
                    </div>
                  ) : (
                    <span className="flex items-center rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--sea-ink-soft)]">
                      %
                    </span>
                  )}
                </div>
                {form.formState.errors.value ? (
                  <p className="text-xs text-[var(--destructive)]">
                    {form.formState.errors.value.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-3">
              <Label>Duration</Label>
              <SegmentedControl
                value={duration}
                options={[
                  { value: 'once', label: 'Once' },
                  { value: 'forever', label: 'Forever' },
                  { value: 'repeating', label: 'Repeating' },
                ]}
                onChange={(v) =>
                  form.setValue('duration', v as 'once' | 'forever' | 'repeating', { shouldValidate: true })
                }
              />
            </div>

            {duration === 'repeating' ? (
              <div className="flex flex-col gap-2 pt-2">
                <Label htmlFor="dcc-months">Duration in months</Label>
                <Input
                  id="dcc-months"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={3}
                  {...form.register('durationMonths')}
                />
                {form.formState.errors.durationMonths ? (
                  <p className="text-xs text-[var(--destructive)]">
                    {form.formState.errors.durationMonths.message}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 pt-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="dcc-max">Max redemptions</Label>
                <Input
                  id="dcc-max"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Unlimited"
                  {...form.register('maxRedemptions')}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dcc-expiry">Expiration date</Label>
                <Input
                  id="dcc-expiry"
                  type="date"
                  {...form.register('redeemBy')}
                />
              </div>
            </div>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (next: T) => void
}) {
  return (
    <div className="inline-flex w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-0.5">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-all duration-150',
              active
                ? 'bg-[var(--lagoon-deep)] text-white shadow-[0_4px_12px_-4px_rgba(50,143,151,0.6)]'
                : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]',
            )}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
