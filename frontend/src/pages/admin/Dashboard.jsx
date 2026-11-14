import { useEffect, useState } from 'react'
import { shopApi } from '../../services/api'
import { StatCard, PageLoader, Badge, TableWrapper, Th, Td } from '../../components/UI'
import { Users, Package, ClipboardList, CreditCard, AlertCircle, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { Link } from "react-router-dom";
export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [recentBorrows, setRecentBorrows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      shopApi.adminDashboard(),
      shopApi.getBorrows({ ordering: '-created_at', page_size: 8 }),
    ]).then(([s, b]) => {
      setStats(s.data)
      setRecentBorrows(b.data.results || b.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader />

  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">Overview of your shop activity</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Customers" value={stats.total_customers} icon={Users} color="indigo" />
        <StatCard label="Active Items" value={stats.total_items} icon={Package} color="blue" />
        <StatCard label="Total Due" value={fmt(stats.financials.total_due)} icon={AlertCircle} color="amber" />
        <StatCard label="Collected" value={fmt(stats.financials.total_collected)} icon={TrendingUp} color="green" />
        <StatCard label="Pending for payment verification" value={stats.unverified_payments} icon={TrendingUp} color="green" />
      </div>



      {/* Unverified payments alert */}
      {stats.unverified_payments > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            {stats.unverified_payments} unverified payment{stats.unverified_payments > 1 ? 's' : ''} waiting for your approval.
          </p>
          <a href="/admin/payments" className="ml-auto text-sm font-semibold text-amber-700 underline whitespace-nowrap">Review →</a>
        </div>
      )}

      {/* Recent borrows table */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Recent Borrow Entries</h2>
        </div>
        {recentBorrows.length > 10 && (
          <div className="mt-4 lex justify-center">
            <Link
              to="/admin/borrows"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              View All Borrows
            </Link>
          </div>
        )}
        <TableWrapper>
          <thead>
            <tr>
              <Th>Customer</Th><Th>Items</Th>
              <Th>Amount</Th><Th>Date</Th>
            </tr>
          </thead>
          <tbody>
            {recentBorrows.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-sm text-slate-400">No entries yet</td></tr>
            )}
            {recentBorrows.slice(0, 5).map((b) => (
              <tr key={b.id} className="hover:bg-slate-50/50">
                <Td className="font-medium">{b.customer_name}</Td>
                <Td>{b.items?.length ?? 0} item{b.items?.length !== 1 ? 's' : ''}</Td>
                <Td className="font-medium">{fmt(b.total_amount)}</Td>
                <Td className="text-slate-400 text-xs">{format(new Date(b.created_at), 'dd MMM yyyy')}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrapper>
      </div>
    </div>
  )
}
