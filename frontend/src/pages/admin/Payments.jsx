import { useEffect, useState, useMemo } from 'react'
import { shopApi, authApi } from '../../services/api'
import {
  Modal, PageLoader, EmptyState, TableWrapper, Th, Td,
  SearchableSelect, DateRangeFilter, ConfirmDialog, SelectCheckbox, BulkActionBar
} from '../../components/UI'
import toast from 'react-hot-toast'
import { CheckCircle, CreditCard, Phone, X } from 'lucide-react'
import { format } from 'date-fns'

const fmt = (n) => `₹${Math.ceil(Number(n)).toLocaleString('en-IN')}`

export default function AdminPayments() {
  const [payments,setPayments]       = useState([])
  const [unverifiedCount,setUnverifiedCount] = useState(0)
  const [customers,setCustomers]     = useState([])
  const [loading,setLoading]         = useState(true)
  const [tab,setTab]                 = useState('unverified')
  const [verifyTarget,setVerifyTarget] = useState(null)
  const [verifyForm,setVerifyForm]   = useState({method:'online',paid_at:''})
  const [saving,setSaving]           = useState(false)

  // Filters
  const [filterCustomer,setFilterCustomer] = useState('')
  const [dateFrom,setDateFrom]             = useState('')
  const [dateTo,setDateTo]                 = useState('')

  // Multi-select (verified tab only)
  const [selected,setSelected]       = useState(new Set())
  const [bulkDeleting,setBulkDeleting] = useState(false)
  const [confirmBulk,setConfirmBulk] = useState(false)

  const filterParams = useMemo(()=>{
    const p={verified:tab==='verified'?'true':'false'}
    if(filterCustomer) p.customer=filterCustomer
    if(dateFrom)       p.date_from=dateFrom
    if(dateTo)         p.date_to=dateTo
    return p
  },[tab,filterCustomer,dateFrom,dateTo])

  const load = async()=>{
    setLoading(true)
    try{
      const [cur,unv]=await Promise.all([shopApi.getPayments(filterParams),shopApi.getPayments({verified:'false'})])
      setPayments(cur.data.results??cur.data)
      setUnverifiedCount((unv.data.results??unv.data).length)
      setSelected(new Set())
    }catch{toast.error('Failed to load')} finally{setLoading(false)}
  }

  useEffect(()=>{load()},[tab,filterCustomer,dateFrom,dateTo])
  useEffect(()=>{authApi.getCustomers().then(r=>setCustomers(r.data.results??r.data))},[])

  const customerOptions = useMemo(()=>customers.map(c=>({
    value:c.id, label:`${c.first_name} ${c.last_name}`.trim()||c.username,
    sub:`@${c.username}${c.phone_number?' · '+c.phone_number:''}`
  })),[customers])

  // Selection (only on verified tab)
  const allIds       = payments.map(p=>p.id)
  const allSelected  = selected.size===allIds.length&&allIds.length>0
  const someSelected = selected.size>0&&!allSelected
  const toggleAll    = ()=>setSelected(allSelected?new Set():new Set(allIds))
  const toggleOne    = id=>setSelected(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n})

  const openVerify = p=>{
    setVerifyTarget(p)
    setVerifyForm({method:p.method||'online',paid_at:format(new Date(p.paid_at),"yyyy-MM-dd'T'HH:mm")})
  }

  const handleVerify = async e=>{
    e.preventDefault(); setSaving(true)
    try{
      await shopApi.verifyPayment(verifyTarget.id,verifyForm)
      toast.success('Payment verified! ✓'); setVerifyTarget(null); load()
    }catch(err){toast.error(err.response?.data?.detail||'Failed')} finally{setSaving(false)}
  }

  const handleBulkDelete = async()=>{
    setBulkDeleting(true)
    try{
      const res=await shopApi.bulkDeletePayments([...selected])
      toast.success(`${res.data.deleted} payment${res.data.deleted!==1?'s':''} deleted`)
      setConfirmBulk(false); load()
    }catch{toast.error('Bulk delete failed')} finally{setBulkDeleting(false)}
  }

  const hasFilters=filterCustomer||dateFrom||dateTo
  const visibleTotal=payments.reduce((s,p)=>s+Math.ceil(Number(p.amount)),0)

  if(loading) return <PageLoader/>

  return (
    <div className="space-y-5 max-w-5xl pb-24">
      <div><h1 className="text-xl font-bold text-slate-800">Payments</h1><p className="text-sm text-slate-400 mt-0.5">Review and verify customer payments</p></div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[['unverified','Awaiting Verification'],['verified','Verified']].map(([k,l])=>(
          <button key={k} onClick={()=>{setTab(k);setSelected(new Set())}}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab===k?'bg-indigo-600 text-white':'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {l}
            {k==='unverified'&&unverifiedCount>0&&<span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">{unverifiedCount}</span>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Customer:</span>
          <div className="w-72"><SearchableSelect options={[{value:'',label:'All Customers'},...customerOptions]} value={filterCustomer} onChange={setFilterCustomer} placeholder="Filter by customer…"/></div>
        </div>
        <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onClear={()=>{setDateFrom('');setDateTo('')}}/>
        {hasFilters&&<button onClick={()=>{setFilterCustomer('');setDateFrom('');setDateTo('')}} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"><X className="w-3 h-3"/>Clear</button>}
      </div>

      {payments.length===0
        ? <EmptyState icon={CreditCard} title={tab==='unverified'?'No pending payments':'No verified payments'} description={tab==='unverified'?'All verified ✓':'Verified payments appear here'}/>
        : (
          <div className="card !p-0 overflow-hidden">
            <TableWrapper>
              <thead>
                <tr>
                  {/* Checkbox only on verified tab (only verified can be bulk-deleted) */}
                  {tab==='verified'&&<Th className="w-10"><SelectCheckbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll}/></Th>}
                  <Th>Customer</Th><Th>Amount</Th><Th>Method</Th>
                  <Th>Note</Th><Th>Date</Th><Th>Verified By</Th>
                  {tab==='unverified'&&<Th>Action</Th>}
                </tr>
              </thead>
              <tbody>
                {payments.map(p=>(
                  <tr key={p.id} className={`hover:bg-slate-50/50 ${selected.has(p.id)?'bg-indigo-50/50':''}`}>
                    {tab==='verified'&&<Td onClick={e=>e.stopPropagation()}><SelectCheckbox checked={selected.has(p.id)} onChange={()=>toggleOne(p.id)}/></Td>}
                    <Td>
                      <p className="font-medium">{p.customer_name}</p>
                      {p.customer_phone&&<p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3"/>{p.customer_phone}</p>}
                    </Td>
                    <Td className="font-semibold text-base">{fmt(p.amount)}</Td>
                    <Td><span className={`badge ${p.method==='cash'?'bg-slate-100 text-slate-600':'bg-purple-100 text-purple-700'}`}>{p.method_display}</span></Td>
                    <Td>{p.screenshot_note?<span className="text-xs text-slate-500 max-w-[140px] block truncate">{p.screenshot_note}</span>:<span className="text-slate-300 text-xs">—</span>}</Td>
                    <Td className="text-xs text-slate-400 whitespace-nowrap">{format(new Date(p.paid_at),'dd MMM yyyy, hh:mm a')}</Td>
                    <Td className="whitespace-nowrap">{p.is_verified?<span className="text-xs text-green-600 font-semibold">✓ {p.verified_by_name||'Verified'}</span>:<span className="text-xs text-amber-500">Pending</span>}</Td>
                    {tab==='unverified'&&<Td><button className="btn-primary !py-1.5 !text-xs whitespace-nowrap" onClick={()=>openVerify(p)}><CheckCircle className="w-3.5 h-3.5"/>Verify</button></Td>}
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
            <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 flex justify-end gap-3 text-sm">
              <span className="text-slate-500">{payments.length} shown</span>
              <span className="font-bold text-slate-800">Total: {fmt(visibleTotal)}</span>
            </div>
          </div>
        )
      }

      {/* Verify modal */}
      <Modal open={!!verifyTarget} onClose={()=>setVerifyTarget(null)} title="Verify Payment">
        {verifyTarget&&(
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl text-sm">
              <div className="flex justify-between mb-1"><span className="text-slate-500">Customer</span><span className="font-medium">{verifyTarget.customer_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-bold text-lg">{fmt(verifyTarget.amount)}</span></div>
            </div>
            <div>
              <label className="label">Payment Method</label>
              <div className="flex gap-3">
                {[['online','📱 Online (UPI)'],['cash','💵 Cash']].map(([v,l])=>(
                  <label key={v} className={`flex-1 flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-colors text-sm font-medium ${verifyForm.method===v?'border-indigo-500 bg-indigo-50 text-indigo-700':'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    <input type="radio" name="method" value={v} className="sr-only" checked={verifyForm.method===v} onChange={()=>setVerifyForm(p=>({...p,method:v}))}/>
                    {l}
                  </label>
                ))}
              </div>
            </div>
            <div><label className="label">Payment Date</label><input className="input" type="datetime-local" value={verifyForm.paid_at} onChange={e=>setVerifyForm(p=>({...p,paid_at:e.target.value}))}/></div>
            <div className="flex gap-3 pt-2">
              <button type="button" className="btn-secondary flex-1" onClick={()=>setVerifyTarget(null)}>Cancel</button>
              <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving?'Verifying…':'✓ Mark Verified'}</button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog open={confirmBulk} onClose={()=>setConfirmBulk(false)} onConfirm={handleBulkDelete} loading={bulkDeleting}
        title={`Delete ${selected.size} Verified Payment${selected.size!==1?'s':''}?`}
        message={`Permanently delete ${selected.size} verified payment record${selected.size!==1?'s':''}? This cannot be undone and may affect customer balance calculations.`}/>

      {/* BulkActionBar only on verified tab */}
      {tab==='verified'&&(
        <BulkActionBar count={selected.size} label="payment" onDelete={()=>setConfirmBulk(true)} onClear={()=>setSelected(new Set())} deleting={bulkDeleting}/>
      )}
    </div>
  )
}