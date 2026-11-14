import { useEffect, useState } from 'react'
import { shopApi } from '../../services/api'
import { PageLoader, EmptyState, Modal, DateRangeFilter, SummaryBar } from '../../components/UI'
import { ClipboardList, ChevronRight, QrCode, MessageCircle } from 'lucide-react'
import { format } from 'date-fns'

// All amounts are already integers from backend — no Math.ceil needed
const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function CustomerBorrows() {
  const [borrows, setBorrows]     = useState([])
  const [shopData, setShopData]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [detail, setDetail]       = useState(null)
  const [showQR, setShowQR]       = useState(false)
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')

  const load = () => {
    const params = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo)   params.date_to   = dateTo

    Promise.all([
      shopApi.getBorrows(params),
      shopApi.customerDashboard(),
    ])
      .then(([b, s]) => {
        setBorrows(b.data.results ?? b.data)
        setShopData(s.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [dateFrom, dateTo])

  // Pay button: disabled when customer has advance (already overpaid)
  const totalDue  = Number(shopData?.total_due  ?? 0)
  const advance   = Number(shopData?.advance    ?? 0)
  const hasDue    = totalDue > 0
  const hasAdvance = advance > 0

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 max-w-2xl">

      {/* ── Header + single Pay button ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">My Borrows</h1>
          <p className="text-sm text-slate-400 mt-0.5">All items you have borrowed from the shop</p>
        </div>

        {/* Show Pay button only when there's due AND no advance */}
        {(hasDue || hasAdvance) && (
          <button
            onClick={() => setShowQR(true)}
            disabled={hasAdvance}
            title={hasAdvance ? `You have ₹${advance} advance — nothing to pay` : ''}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors shadow-md
              ${hasAdvance
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              }`}
          >
            <QrCode className="w-4 h-4" />
            {hasAdvance ? `Advance ₹${advance}` : `Pay ${fmt(totalDue)}`}
          </button>
        )}
      </div>

      {/* ── Date filter only (no status chips) ── */}
      <DateRangeFilter
        from={dateFrom}
        to={dateTo}
        onFromChange={setDateFrom}
        onToChange={setDateTo}
        onClear={() => { setDateFrom(''); setDateTo('') }}
      />

      {/* ── Global summary bar from backend (accurate, not filtered) ── */}
      {shopData && (
        <SummaryBar
          borrowed={shopData.total_payable}
          paid={shopData.total_paid}
          advance={shopData.advance}
          due={shopData.total_due}
        />
      )}

      {/* ── Entry list ── */}
      {borrows.length === 0
        ? <EmptyState icon={ClipboardList} title="No borrow entries" description="No entries match the selected date range" />
        : (
          <div className="space-y-3">
            {borrows.map(b => (
              /* Card: shows ONLY date + borrowed amount */
              <button
                key={b.id}
                onClick={() => setDetail(b)}
                className="w-full card hover:shadow-md transition-shadow text-left flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400">{format(new Date(b.created_at), 'dd MMM yyyy')}</p>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{fmt(b.total_amount)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )
      }

      {/* ── Global QR Payment modal ── */}
      <Modal open={showQR} onClose={() => setShowQR(false)} title="Pay Total Due">
        <div className="space-y-4 text-center">
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
            <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide mb-1">Total Due</p>
            <p className="text-3xl font-extrabold text-indigo-700">{fmt(totalDue)}</p>
          </div>

          {shopData?.upi_qr_image ? (
            <>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Scan QR Code to Pay</p>
              <div className="flex justify-center">
                <img src={shopData.upi_qr_image} alt="UPI QR"
                  className="w-56 h-56 object-contain rounded-2xl border border-slate-200 shadow-md" />
              </div>
              <p className="text-xs text-slate-400">Google Pay · PhonePe · Paytm · any UPI app</p>
            </>
          ) : (
            <div className="py-8 text-slate-400 text-sm">
              <QrCode className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>QR code not set up yet. Contact the shop owner.</p>
            </div>
          )}

          {shopData?.shop_whatsapp && (
            <a href={`https://wa.me/${shopData.shop_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                `Hi, I have paid ${fmt(totalDue)} (total due). Please verify my payment. Thank you!`
              )}`}
              target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
              <MessageCircle className="w-4 h-4" />
              Send Screenshot on WhatsApp
            </a>
          )}
          <button onClick={() => setShowQR(false)} className="w-full btn-secondary text-sm">Close</button>
        </div>
      </Modal>

      {/* ── Borrow detail modal: Items + Date + Borrowed Amount ONLY ── */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title="Borrow Details">
          <div className="space-y-4">

            {/* Date + Amount header */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="text-xs text-slate-400">Date Borrowed</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">
                  {format(new Date(detail.created_at), 'dd MMM yyyy')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Borrowed Amount</p>
                <p className="text-xl font-extrabold text-slate-800 mt-0.5">{fmt(detail.total_amount)}</p>
              </div>
            </div>

            {/* Items list only */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Items Borrowed</p>
              <div className="space-y-2">
                {detail.items?.map(li => (
                  <div key={li.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    {li.item_image_url && (
                      <img src={li.item_image_url} className="w-8 h-8 rounded-lg object-cover"
                        onError={e => e.target.style.display = 'none'} />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{li.item_name}</p>
                      <p className="text-xs text-slate-400">
                        {li.quantity} × {fmt(li.rate_at_borrow)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{fmt(li.subtotal)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Total line */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="text-sm font-semibold text-slate-600">Total</span>
              <span className="text-lg font-extrabold text-slate-800">{fmt(detail.total_amount)}</span>
            </div>

          </div>
        </Modal>
      )}
    </div>
  )
}