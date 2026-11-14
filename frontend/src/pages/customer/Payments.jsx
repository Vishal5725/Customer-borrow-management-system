import { useEffect, useState } from 'react'
import { shopApi } from '../../services/api'
import { PageLoader, EmptyState, Modal } from '../../components/UI'
import toast from 'react-hot-toast'
import { CreditCard, MessageCircle, ChevronRight, Plus } from 'lucide-react'
import { format } from 'date-fns'

// All amounts are integers from backend
const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function CustomerPayments() {
  const [payments, setPayments]   = useState([])
  const [shopData, setShopData]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)   // detail modal
  const [modal, setModal]         = useState(false)  // record payment modal
  const [saving, setSaving]       = useState(false)
  const [form, setForm] = useState({ amount: '', method: 'online', screenshot_note: '' })

  const load = () => {
    Promise.all([
      shopApi.getPayments(),
      shopApi.customerDashboard(),
    ]).then(([p, s]) => {
      setPayments(p.data.results ?? p.data)
      setShopData(s.data)
    }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const totalDue  = Number(shopData?.total_due  ?? 0)
  const advance   = Number(shopData?.advance    ?? 0)
  const canPay    = totalDue > 0 && advance === 0

  const openModal = () => {
    setForm({ amount: String(totalDue), method: 'online', screenshot_note: '' })
    setModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
    setSaving(true)
    try {
      // No entry selection — backend auto-picks oldest pending entry
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

  if (loading) return <PageLoader />

  const pendingCount = payments.filter(p => !p.is_verified).length

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Payments</h1>
          <p className="text-sm text-slate-400 mt-0.5">Your payment history</p>
        </div>
        {/* Record Payment — only when there's due and no advance */}
        {canPay && (
          <button onClick={openModal} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        )}
      </div>

      {/* Pending verification banner */}
      {pendingCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-700 flex items-start gap-3">
          <span className="mt-0.5">⏳</span>
          <div className="flex-1">
            <p className="font-medium">{pendingCount} payment{pendingCount > 1 ? 's' : ''} awaiting verification</p>
            {shopData?.shop_whatsapp && (
              <a href={`https://wa.me/${shopData.shop_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hi, I have made a payment. Please verify it.')}`}
                target="_blank" rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 font-medium underline">
                <MessageCircle className="w-3.5 h-3.5" /> Remind on WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      {payments.length === 0
        ? <EmptyState icon={CreditCard} title="No payments yet" description="Tap 'Record Payment' to log a payment after scanning the QR code" />
        : (
          <div className="space-y-2">
            {payments.map(p => (
              <button key={p.id} onClick={() => setSelected(p)}
                className="w-full card flex items-center gap-4 text-left hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${p.is_verified ? 'bg-green-100' : 'bg-amber-100'}`}>
                  <CreditCard className={`w-5 h-5 ${p.is_verified ? 'text-green-600' : 'text-amber-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge ${p.is_verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.is_verified ? '✓ Verified' : '⏳ Pending'}
                    </span>
                    {p.is_verified && p.verified_by_name && (
                      <span className="text-xs text-green-600 font-medium">by {p.verified_by_name}</span>
                    )}
                    <span className="text-xs text-slate-400">{p.method_display}</span>
                  </div>
                  {/* No Entry ID shown */}
                  <p className="text-xs text-slate-400 mt-0.5">
                    {format(new Date(p.paid_at), 'dd MMM yyyy, hh:mm a')}
                  </p>
                  {p.screenshot_note && (
                    <p className="text-xs text-slate-400 truncate max-w-xs">Note: {p.screenshot_note}</p>
                  )}
                </div>
                <p className="font-bold text-slate-800 flex-shrink-0">{fmt(p.amount)}</p>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )
      }

      {/* ── Record Payment modal — no entry selection ── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Record a Payment">
        {shopData?.upi_qr_image && (
          <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl mb-4">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Step 1 — Scan & Pay</p>
            <img src={shopData.upi_qr_image} alt="UPI QR"
              className="w-44 h-44 object-contain rounded-xl border border-slate-200" />
            {shopData.shop_whatsapp && (
              <a href={`https://wa.me/${shopData.shop_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hi, I have made a payment. Please verify. Here is my screenshot.')}`}
                target="_blank" rel="noreferrer"
                className="mt-3 btn-secondary !text-xs !py-1.5 !border-green-300 !text-green-700">
                <MessageCircle className="w-3.5 h-3.5" />
                Step 2 — Send screenshot to owner
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
              {[['online', '📱 Online (UPI)'], ['cash', '💵 Cash']].map(([v, label]) => (
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

      {/* ── Payment detail modal — no Entry ID ── */}
      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={`Payment #${selected.id}`}>
          <div className="space-y-4">
            <div className={`flex items-center gap-3 p-3 rounded-xl ${selected.is_verified ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              <CreditCard className={`w-5 h-5 flex-shrink-0 ${selected.is_verified ? 'text-green-600' : 'text-amber-600'}`} />
              <div>
                <p className={`text-sm font-semibold ${selected.is_verified ? 'text-green-700' : 'text-amber-700'}`}>
                  {selected.is_verified ? '✓ Payment Verified' : '⏳ Awaiting Verification'}
                </p>
                {selected.is_verified && selected.verified_by_name && (
                  <p className="text-xs text-green-600 mt-0.5">Verified by {selected.verified_by_name}</p>
                )}
              </div>
            </div>

            <div className="space-y-0 text-sm divide-y divide-slate-100">
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-bold text-lg text-slate-800">{fmt(selected.amount)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">Payment Method</span>
                <span className={`badge ${selected.method === 'cash' ? 'bg-slate-100 text-slate-600' : 'bg-purple-100 text-purple-700'}`}>
                  {selected.method_display}
                </span>
              </div>
              {/* No Entry ID row */}
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">Payment Date</span>
                <span className="font-medium">{format(new Date(selected.paid_at), 'dd MMM yyyy, hh:mm a')}</span>
              </div>
              {selected.is_verified && selected.verified_at && (
                <div className="flex justify-between py-2.5">
                  <span className="text-slate-500">Verified On</span>
                  <span className="font-medium text-green-700">{format(new Date(selected.verified_at), 'dd MMM yyyy, hh:mm a')}</span>
                </div>
              )}
              {selected.screenshot_note && (
                <div className="flex justify-between py-2.5">
                  <span className="text-slate-500">Note</span>
                  <span className="text-slate-700 text-right max-w-[60%]">{selected.screenshot_note}</span>
                </div>
              )}
            </div>

            {!selected.is_verified && shopData?.shop_whatsapp && (
              <a href={`https://wa.me/${shopData.shop_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Hi, I submitted a payment of ${fmt(selected.amount)} (Payment #${selected.id}). Please verify it. Thank you!`
                )}`}
                target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
                <MessageCircle className="w-4 h-4" />
                Remind Owner on WhatsApp
              </a>
            )}
            <button onClick={() => setSelected(null)} className="w-full btn-secondary text-sm">Close</button>
          </div>
        </Modal>
      )}
    </div>
  )
}