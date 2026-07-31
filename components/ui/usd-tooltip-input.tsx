'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Currency = 'INR' | 'USD' | 'GBP' | 'EUR'

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  INR: '₹',
  USD: '$',
  GBP: '£',
  EUR: '€',
}

type RateState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; rate: number; label: string }
  | { status: 'err' }

interface SmartCurrencyInputProps {
  /** Used to fetch the historical rate (YYYY-MM-DD). Live rate used if omitted. */
  referenceDate?: string
  /** Called with the INR equivalent whenever it changes. */
  onInrChange?: (inrValue: number, meta: { usd: number; rate: number }) => void
  /** Called whenever the active currency or rate changes */
  onCurrencyStateChange?: (currency: Currency, rate: number | null) => void
  /** Spread onto the underlying <input> for react-hook-form compatibility. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
  disabled?: boolean
  placeholder?: string
  className?: string
  /** Label text rendered above the input with rate badge on the right */
  label?: string
  required?: boolean
  /** Restores the currency state (e.g. 'USD') */
  defaultCurrency?: Currency
  /** Restores the exact exchange rate used to calculate the INR value */
  defaultExchangeRate?: number | null
  /** The initial INR value saved in the database, used to reverse-calculate USD */
  defaultInrValue?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SmartCurrencyInput({
  referenceDate,
  onInrChange,
  onCurrencyStateChange,
  inputProps = {},
  disabled = false,
  placeholder = '0',
  className = '',
  label,
  required = false,
  defaultCurrency = 'INR',
  defaultExchangeRate = null,
  defaultInrValue = 0,
}: SmartCurrencyInputProps) {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency)
  const [open, setOpen] = useState(false)
  
  // If we're opening an existing foreign currency record, reverse-calculate the foreign amount for rawValue
  const initialForeignValue = defaultCurrency !== 'INR' && defaultExchangeRate && defaultInrValue > 0
    ? (defaultInrValue / defaultExchangeRate).toFixed(2).replace(/\.00$/, '')
    : ''
    
  const [rawValue, setRawValue] = useState(initialForeignValue)
  const [rateState, setRateState] = useState<RateState>(
    defaultExchangeRate && defaultCurrency !== 'INR' 
      ? { status: 'ok', rate: defaultExchangeRate, label: 'saved' }
      : { status: 'idle' }
  )
  const [showCustom, setShowCustom] = useState(false)
  const [customRate, setCustomRate] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isForeign = currency !== 'INR'
  const numVal = parseFloat(rawValue) || 0

  const effectiveRate =
    customRate ? parseFloat(customRate) :
    rateState.status === 'ok' ? rateState.rate : null

  const inrPreview = isForeign && effectiveRate && numVal > 0
    ? numVal * effectiveRate
    : null

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Fetch rate whenever foreign currency is active or referenceDate changes ────────────
  const fetchRate = useCallback(async (date?: string, targetCurrency?: Currency) => {
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setRateState({ status: 'loading' })

    const activeCurrency = targetCurrency || currency
    const curParam = activeCurrency.toLowerCase()

    try {
      const today = new Date().toISOString().split('T')[0]
      const isHistorical = date && date !== today
      const tag = isHistorical ? date : 'latest'
      const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${tag}/v1/currencies/${curParam}.json`
      const label = isHistorical
        ? new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'live'

      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) throw new Error('bad response')
      const json = await res.json()
      const rate: number = json?.[curParam]?.inr
      if (!rate) throw new Error('no INR rate')

      setRateState({ status: 'ok', rate, label })
    } catch (e: any) {
      if (e.name !== 'AbortError') setRateState({ status: 'err' })
    }
  }, [currency])

  const isSavedRate = rateState.status === 'ok' && rateState.label === 'saved'

  useEffect(() => {
    if (!isForeign) return
    if (defaultExchangeRate && defaultCurrency === currency && isSavedRate) {
      return // skip fetching if we just loaded the saved rate
    }
    fetchRate(referenceDate, currency)
  }, [isForeign, referenceDate, fetchRate, currency, defaultExchangeRate, defaultCurrency, isSavedRate])

  // ── Notify parent ─────────────────────────────────────────────────────────
  const onInrChangeRef = useRef(onInrChange)
  onInrChangeRef.current = onInrChange

  const onCurrencyStateChangeRef = useRef(onCurrencyStateChange)
  onCurrencyStateChangeRef.current = onCurrencyStateChange

  useEffect(() => {
    if (inrPreview !== null && effectiveRate && onInrChangeRef.current) {
      onInrChangeRef.current(inrPreview, { usd: numVal, rate: effectiveRate })
    }
  }, [inrPreview, effectiveRate, numVal])

  useEffect(() => {
    if (onCurrencyStateChangeRef.current) {
      onCurrencyStateChangeRef.current(currency, isForeign ? effectiveRate : null)
    }
  }, [currency, effectiveRate, isForeign])

  // ── Currency switch ───────────────────────────────────────────────────────
  const switchCurrency = (c: Currency) => {
    setCurrency(c)
    setOpen(false)
    setRawValue('')
    setCustomRate('')
    setShowCustom(false)
    if (c === 'INR') setRateState({ status: 'idle' })
  }

  // ── Input class ───────────────────────────────────────────────────────────
  const inputBase = `flex-1 min-w-0 px-3 py-2 bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none ${className}`

  // ── Extract RHF props for INR mode ────────────────────────────────────────
  const { onChange: rhfOnChange, onBlur: rhfOnBlur, ref: rhfRef, name, ...restInputProps } = inputProps as any

  // In INR mode, we don't want to show ugly floating point numbers if we can avoid it.
  // We use defaultInrValue if the input is uncontrolled and hasn't changed.
  const displayValue = isForeign 
    ? rawValue 
    : (restInputProps.value !== undefined ? restInputProps.value : defaultInrValue)

  return (
    <div className="space-y-1.5">

      {/* ── Label row with rate badge on the right ───────────────────── */}
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-text-secondary">
            {label}{required && ' *'}
          </label>

          {/* Rate badge — only when foreign currency is active */}
          {isForeign && (
            <span className="text-[11px] text-text-muted leading-none flex items-center gap-1.5">
              {rateState.status === 'loading' && (
                <span className="flex items-center gap-1">
                  {/* pulsing dot while fetching */}
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-text-muted opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-text-muted" />
                  </span>
                  <span className="text-text-muted">fetching…</span>
                </span>
              )}
              {rateState.status === 'ok' && !customRate && (
                <>
                  {/* blinking green dot for live / static dot for historical */}
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    {rateState.label === 'live' && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    )}
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${rateState.label === 'live' ? 'bg-success' : 'bg-text-muted'}`} />
                  </span>
                  <span className="text-text font-medium">1 {currency} = ₹{rateState.rate.toFixed(2)}</span>
                </>
              )}
              {rateState.status === 'ok' && customRate && (
                <>
                  <span className="text-text-secondary">₹{parseFloat(customRate).toFixed(2)}/1 {currency}</span>
                  <button type="button" onClick={() => { setCustomRate(''); setShowCustom(false) }} className="text-danger hover:underline">✕</button>
                </>
              )}
              {rateState.status === 'err' && (
                <button type="button" onClick={() => setShowCustom(true)} className="text-warning underline">enter rate manually</button>
              )}
            </span>
          )}

        </div>
      )}

      {/* ── Main input row ─────────────────────────────────────────────── */}
      <div className="flex items-stretch bg-bg border border-border rounded-lg focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
        {/* Currency selector */}
        <div ref={dropdownRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => !disabled && setOpen(o => !o)}
            className="flex items-center gap-1 h-full px-3 text-xs font-medium text-text-secondary border-r border-border hover:bg-bg-tertiary transition-colors rounded-l-lg"
          >
            <span className="text-text-muted">{CURRENCY_SYMBOLS[currency]}</span>
            <span>{currency}</span>
            <ChevronDown size={11} className={`text-text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute left-0 top-full mt-1 w-24 bg-bg-secondary border border-border rounded-lg shadow-xl z-30 overflow-hidden py-1">
              {(['INR', 'USD', 'GBP', 'EUR'] as Currency[]).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => switchCurrency(c)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                    currency === c ? 'text-primary bg-primary/5' : 'text-text-secondary hover:bg-bg-tertiary'
                  }`}
                >
                  <span className="text-text-muted">{CURRENCY_SYMBOLS[c]}</span>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Amount input */}
        <div className="flex-1 flex items-center">
          {/* ── Hidden input for RHF registration ── */}
          <input type="hidden" name={name} ref={rhfRef} value={isForeign ? (inrPreview ?? '') : (restInputProps.value !== undefined ? restInputProps.value : defaultInrValue)} />
          
          {/* ── Visible input ── */}
          <input
            name={name}
            type="number"
            step="any"
            min={0}
            placeholder={placeholder}
            disabled={disabled}
            className={inputBase}
            defaultValue={!isForeign && restInputProps.value === undefined ? Number(defaultInrValue.toFixed(2).replace(/\.00$/, '')) : undefined}
            value={isForeign ? rawValue : restInputProps.value}
            onChange={(e) => {
              if (isForeign) {
                setRawValue(e.target.value)
              } else {
                if (rhfOnChange) {
                  e.target.name = name || '';
                  rhfOnChange(e);
                }
                if (onInrChangeRef.current) {
                  onInrChangeRef.current(parseFloat(e.target.value) || 0, { usd: 0, rate: 1 });
                }
              }
            }}
            onBlur={rhfOnBlur}
          />
        </div>
      </div>

      {/* ── Single row: bank rate toggle (left) + INR result (right) ─── */}
      {isForeign && rateState.status === 'ok' && !customRate && (
        <div className="flex items-center justify-between px-0.5">
          <button
            type="button"
            onClick={() => setShowCustom(s => !s)}
            className="flex items-center gap-0.5 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
          >
            <ChevronDown size={10} className={`transition-transform ${showCustom ? 'rotate-180' : ''}`} />
            Bank rate
          </button>
          {inrPreview !== null && (
            <span className="text-xs font-medium text-success tabular-nums">
              {fmtINR(inrPreview)}
            </span>
          )}
        </div>
      )}

      {isForeign && showCustom && (
        <div className="flex items-center gap-2">
          <div className="flex items-stretch bg-bg border border-border rounded-lg focus-within:border-primary/50 transition-all flex-1">
            <span className="flex items-center px-2.5 text-xs text-text-muted border-r border-border bg-bg-tertiary rounded-l-lg">₹</span>
            <input
              type="number" min="0" step="any"
              placeholder={rateState.status === 'ok' ? rateState.rate.toFixed(2) : 'e.g. 84.52'}
              value={customRate}
              onChange={e => setCustomRate(e.target.value)}
              className="flex-1 min-w-0 px-3 py-1.5 bg-transparent text-xs text-text placeholder:text-text-muted focus:outline-none"
            />
          </div>
          <span className="text-[11px] text-text-muted whitespace-nowrap">per 1 {currency}</span>
        </div>
      )}
    </div>
  )
}
