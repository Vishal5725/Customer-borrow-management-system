// Reusable UI primitives
import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, X, Trash2, CheckSquare, Square } from 'lucide-react'

export function Spinner({ size = 'md' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size]
  return <div className={`${s} border-2 border-indigo-600 border-t-transparent rounded-full animate-spin`} />
}

export function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center py-24">
      <Spinner size="lg" />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>}
      <p className="font-semibold text-slate-700">{title}</p>
      {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, sub, icon: Icon, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green:  'bg-green-50  text-green-600',
    amber:  'bg-amber-50  text-amber-600',
    red:    'bg-red-50    text-red-600',
    blue:   'bg-blue-50   text-blue-600',
  }
  return (
    <div className="card flex items-start gap-4">
      {Icon && (
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function Badge({ status }) {
  const map    = { pending: 'badge-pending', partial: 'badge-partial', paid: 'badge-paid' }
  const labels = { pending: 'Pending', partial: 'Pending', paid: 'Paid' }
  return <span className={map[status] || 'badge bg-slate-100 text-slate-600'}>{labels[status] || status}</span>
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, loading, danger = true }) {
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-500 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Confirm'}
        </button>
      </div>
    </Modal>
  )
}

export function FormField({ label, error, children }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

export function TableWrapper({ children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, className = '' }) {
  return <th className={`px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide bg-slate-50 ${className}`}>{children}</th>
}

export function Td({ children, className = '', onClick }) {
  return <td onClick={onClick} className={`px-4 py-3 text-slate-700 border-t border-slate-50 ${className}`}>{children}</td>
}

// ── SelectCheckbox ────────────────────────────────────────────────────────────
/** Checkbox cell used in bulk-select tables */
export function SelectCheckbox({ checked, onChange, indeterminate = false }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
    />
  )
}

// ── BulkActionBar ─────────────────────────────────────────────────────────────
/**
 * Sticky bottom bar that appears when rows are selected.
 * Props:
 *   count     — number of selected rows
 *   onDelete  — async fn called when Delete is clicked
 *   onClear   — fn to clear selection
 *   deleting  — bool while API call is in flight
 *   label     — noun for the items, e.g. "customer" (pluralised automatically)
 *   extraActions — optional ReactNode for additional action buttons
 */
export function BulkActionBar({ count, onDelete, onClear, deleting, label = 'item', extraActions }) {
  if (count === 0) return null
  const noun = count === 1 ? label : `${label}s`
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl shadow-black/30 animate-in slide-in-from-bottom-4">
      <span className="text-sm font-semibold">
        <span className="px-2 py-0.5 bg-indigo-500 rounded-lg mr-2">{count}</span>
        {noun} selected
      </span>
      <div className="w-px h-5 bg-white/20" />
      {extraActions}
      <button
        onClick={onDelete}
        disabled={deleting}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
      >
        {deleting ? <Spinner size="sm" /> : <Trash2 className="w-3.5 h-3.5" />}
        Delete {noun}
      </button>
      <button onClick={onClear}
        className="flex items-center gap-1 text-white/60 hover:text-white text-sm transition-colors">
        <X className="w-3.5 h-3.5" /> Clear
      </button>
    </div>
  )
}

// ── SearchableSelect ──────────────────────────────────────────────────────────
export function SearchableSelect({ options = [], value, onChange, placeholder = 'Search…', disabled = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const selected = options.find(o => String(o.value) === String(value))
  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sub && o.sub.toLowerCase().includes(query.toLowerCase()))
      )
    : options

  useEffect(() => {
    function handle(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const handleOpen   = () => { if (disabled) return; setOpen(true); setQuery(''); setTimeout(() => inputRef.current?.focus(), 50) }
  const handleSelect = (val) => { onChange(val); setOpen(false); setQuery('') }
  const handleClear  = (e)   => { e.stopPropagation(); onChange(''); setOpen(false); setQuery('') }

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={handleOpen} disabled={disabled}
        className={`input w-full text-left flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <span className="flex-1 truncate">
          {selected ? <span className="text-slate-800">{selected.label}</span>
                    : <span className="text-slate-400">{placeholder}</span>}
        </span>
        {selected && !disabled
          ? <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-400 flex-shrink-0" onClick={handleClear} />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Type to search…"
                className="bg-transparent text-sm outline-none w-full text-slate-700 placeholder-slate-400" />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-4 py-3 text-sm text-slate-400 text-center">No results</li>
              : filtered.map(o => (
                <li key={o.value}>
                  <button type="button" onClick={() => handleSelect(o.value)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors ${String(o.value) === String(value) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}>
                    <span className="block font-medium">{o.label}</span>
                    {o.sub && <span className="block text-xs text-slate-400 mt-0.5">{o.sub}</span>}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── DateRangeFilter ───────────────────────────────────────────────────────────
export function DateRangeFilter({ from, to, onFromChange, onToChange, onClear }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date:</span>
      <input type="date" value={from} onChange={e => onFromChange(e.target.value)} className="input !py-1.5 !text-sm w-36" />
      <span className="text-slate-400 text-sm">→</span>
      <input type="date" value={to}   onChange={e => onToChange(e.target.value)}   className="input !py-1.5 !text-sm w-36" />
      {(from || to) && (
        <button type="button" onClick={onClear}
          className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
          <X className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  )
}

// ── SummaryBar ────────────────────────────────────────────────────────────────
export function SummaryBar({ borrowed, paid, advance = 0, due, loading = false }) {
  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`
  if (loading) return (
    <div className="grid grid-cols-3 gap-3 animate-pulse">
      {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
    </div>
  )
  const hasAdvance = Number(advance) > 0
  return (
    <div className={`grid gap-3 ${hasAdvance ? 'grid-cols-4' : 'grid-cols-3'}`}>
      <div className="p-3 bg-blue-50 rounded-xl text-center">
        <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Borrowed</p>
        <p className="text-base font-bold text-blue-700 mt-0.5">{fmt(borrowed)}</p>
      </div>
      <div className="p-3 bg-green-50 rounded-xl text-center">
        <p className="text-xs text-green-500 font-semibold uppercase tracking-wide">Paid</p>
        <p className="text-base font-bold text-green-700 mt-0.5">{fmt(paid)}</p>
      </div>
      {hasAdvance && (
        <div className="p-3 bg-purple-50 rounded-xl text-center">
          <p className="text-xs text-purple-500 font-semibold uppercase tracking-wide">Advance</p>
          <p className="text-base font-bold text-purple-700 mt-0.5">{fmt(advance)}</p>
        </div>
      )}
      <div className={`p-3 rounded-xl text-center ${Number(due) > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${Number(due) > 0 ? 'text-red-500' : 'text-emerald-500'}`}>Due</p>
        <p className={`text-base font-bold mt-0.5 ${Number(due) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(due)}</p>
      </div>
    </div>
  )
}