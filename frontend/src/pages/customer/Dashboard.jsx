import { useEffect, useState } from 'react'
import { shopApi } from '../../services/api'
import { PageLoader, Modal } from '../../components/UI'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { MessageCircle, QrCode, ArrowRight, ClipboardList,
         IndianRupee, CheckCircle2, TrendingDown, TrendingUp, Plus } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

// All amounts are integers from backend
const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function CustomerDashboard() {
  const { user } = useAuth()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)
  const [modal, setModal]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({ amount: '', method: 'online', screenshot_note: '' })

  const load = () => {
    setLoading(true)
    shopApi.customerDashboard().then(r => setData(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <PageLoader />

  const totalDue   = Number(data.total_due)
  const advance    = Number(data.advance)
  const hasAdvance = advance > 0
  const hasDue     = totalDue > 0

  const waLink = `https://wa.me/${data.shop_whatsapp?.replace(/\D/g, '')}?text=${encodeURIComponent(
    'Hi, I have made a payment. Please verify. – ' + (user?.full_name || user?.username)
  )}`

  const openModal = () => {
    setForm({ amount: String(totalDue), method: 'online', screenshot_note: '' })
    setModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
    setSaving(true)
    try {
      await shopApi.createPayment({
        amount: Number(form.amount),
        method: form.method,
        screenshot_note: form.screenshot_note,
      })
      toast.success('Payment recorded! Owner will verify shortly.')
      setModal(false)
      load()
    } catch (err) {
      const msg = err.response?.data?.detail
        || Object.values(err.response?.data || {}).flat().join(' ')
        || 'Failed to submit'
      toast.error(msg)
    } finally { setSaving(false) }
  }

  // Card gradient: purple if advance, red if due, green if all clear
  const cardGradient = hasAdvance
    ? 'from-purple-500 to-violet-600'
    : hasDue
      ? 'from-red-500 to-rose-600'
      : 'from-emerald-500 to-green-600'

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Greeting */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Hello, {user?.first_name || user?.username} 👋 Raju Pan Shop and General Store
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Here's your account summary</p>
        </div>
        {hasDue && (
          <button onClick={openModal} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        )}
      </div>

      {/* ── Payment Summary card (4 stats) ── */}
      <div className={`rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br ${cardGradient}`}>
        <p className="text-xs font-semibold opacity-70 uppercase tracking-wider mb-4">
          Payment Summary
        </p>

        <div className={`grid gap-3 ${hasAdvance ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
          {/* Total Payable */}
          <div className="bg-white/15 rounded-xl p-3 text-center">
            <IndianRupee className="w-3.5 h-3.5 mx-auto mb-1 opacity-70" />
            <p className="text-xs opacity-75 font-medium">Total Payable</p>
            <p className="text-base font-bold mt-0.5">{fmt(data.total_payable)}</p>
          </div>

          {/* Total Paid */}
          <div className="bg-white/15 rounded-xl p-3 text-center">
            <CheckCircle2 className="w-3.5 h-3.5 mx-auto mb-1 opacity-70" />
            <p className="text-xs opacity-75 font-medium">Total Paid</p>
            <p className="text-base font-bold mt-0.5">{fmt(data.total_paid)}</p>
          </div>

          {/* Advance — only shown when advance > 0 */}
          {hasAdvance && (
            <div className="bg-white/25 rounded-xl p-3 text-center ring-2 ring-white/40">
              <TrendingUp className="w-3.5 h-3.5 mx-auto mb-1 opacity-70" />
              <p className="text-xs opacity-75 font-medium">Advance</p>
              <p className="text-base font-bold mt-0.5">{fmt(advance)}</p>
            </div>
          )}

          {/* Remaining Due */}
          <div className={`rounded-xl p-3 text-center ${hasDue ? 'bg-white/20 ring-2 ring-white/30' : 'bg-white/15'}`}>
            <TrendingDown className="w-3.5 h-3.5 mx-auto mb-1 opacity-70" />
            <p className="text-xs opacity-75 font-medium">Remaining Due</p>
            <p className={`font-bold mt-0.5 ${hasDue ? 'text-xl' : 'text-base'}`}>{fmt(totalDue)}</p>
          </div>
        </div>

        <p className="mt-3 text-xs opacity-50 text-center">
          {data.entries_count} borrow {data.entries_count === 1 ? 'entry' : 'entries'} total
          {hasAdvance && ' · You have advance credit — no payment needed'}
        </p>
      </div>

      {/* Pay actions — only when there's due */}
      {hasDue && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Pay Your Balance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.upi_qr_image && (
              <button onClick={() => setShowQR(v => !v)}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <QrCode className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Scan QR & Pay</p>
                  <p className="text-xs text-slate-400">UPI / Google Pay / PhonePe</p>
                </div>
              </button>
            )}
            {data.shop_whatsapp && (
              <a href={waLink} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-green-200 hover:border-green-400 hover:bg-green-50 transition-colors">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Send Screenshot</p>
                  <p className="text-xs text-slate-400">Notify via WhatsApp</p>
                </div>
              </a>
            )}
          </div>
          {showQR && data.upi_qr_image && (
            <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl">
              <img src={data.upi_qr_image} alt="UPI QR" className="w-48 h-48 object-contain rounded-xl" />
              <p className="text-xs text-slate-400 mt-3 text-center">
                Scan with any UPI app · Then send screenshot for verification
              </p>
              {data.shop_whatsapp && (
                <a href={waLink} target="_blank" rel="noreferrer"
                  className="mt-3 btn-primary !bg-green-600 hover:!bg-green-700 !text-sm">
                  <MessageCircle className="w-4 h-4" /> Open WhatsApp ({data.shop_whatsapp})
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Recent Borrows — NO entry ID, NO status badge ── */}
      {data.recent_entries?.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Recent Borrows</h2>
            <Link to="/customer/borrows" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {data.recent_entries.map(e => (
              <div key={e.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  {/* No Entry # ID, no status badge */}
                  <p className="text-sm font-medium text-slate-700">
                    {e.items_count} item{e.items_count !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-slate-400">{format(new Date(e.created_at), 'dd MMM yyyy')}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold">{fmt(e.total_amount)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ── Record Payment modal ── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Record a Payment">
        {data.upi_qr_image && (
          <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl mb-4">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Step 1 — Scan &amp; Pay</p>
            <img src={data.upi_qr_image} alt="UPI QR" className="w-44 h-44 object-contain rounded-xl border border-slate-200" />
            {data.shop_whatsapp && (
              <a href={`https://wa.me/${data.shop_whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent('Hi, I have made a payment. Please verify. Here is my screenshot.')}`}
                target="_blank" rel="noreferrer"
                className="mt-3 btn-secondary !text-xs !py-1.5 !border-green-300 !text-green-700">
                <MessageCircle className="w-3.5 h-3.5" /> Step 2 — Send screenshot to owner
              </a>
            )}
            <p className="text-xs text-slate-400 mt-2 text-center">Then fill the form below to record it</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Amount Paid (₹) *</label>
            <input className="input" type="number" min="1" step="1"
              value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              placeholder={String(totalDue)} />
            <p className="text-xs text-slate-400 mt-1">Total due: {fmt(totalDue)}</p>
          </div>
          <div>
            <label className="label">Payment Method</label>
            <div className="flex gap-3">
              {[['online','📱 Online (UPI)'],['cash','💵 Cash']].map(([v, label]) => (
                <label key={v} className={`flex-1 flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-colors text-sm font-medium
                  ${form.method === v ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <input type="radio" name="method" value={v} className="sr-only"
                    checked={form.method === v} onChange={() => setForm(p => ({ ...p, method: v }))} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Transaction Note (optional)</label>
            <textarea className="input h-16 resize-none"
              value={form.screenshot_note}
              onChange={e => setForm(p => ({ ...p, screenshot_note: e.target.value }))}
              placeholder="e.g. UPI Ref: 123456789" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}