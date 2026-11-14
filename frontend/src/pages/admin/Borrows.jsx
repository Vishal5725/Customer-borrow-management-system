import { useEffect, useState, useMemo, useCallback } from 'react'
import { shopApi, authApi } from '../../services/api'
import {
  Modal, PageLoader, EmptyState, Badge, ConfirmDialog,
  TableWrapper, Th, Td, SearchableSelect, DateRangeFilter,
  SummaryBar, SelectCheckbox, BulkActionBar
} from '../../components/UI'
import toast from 'react-hot-toast'
import { Plus, Trash2, ClipboardList, X, Phone } from 'lucide-react'
import { format } from 'date-fns'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const todayDate = () => new Date().toISOString().split('T')[0]

export default function AdminBorrows() {
  const [borrows,setBorrows]     = useState([])
  const [loading,setLoading]     = useState(true)
  const [summaryLoading,setSummaryLoading] = useState(false)
  const [summary,setSummary]     = useState({total_borrowed:0,total_paid:0,total_due:0})
  const [customers,setCustomers] = useState([])
  const [items,setItems]         = useState([])
  const [modal,setModal]         = useState(false)
  const [detail,setDetail]       = useState(null)
  const [deleteTarget,setDeleteTarget] = useState(null)
  const [deleting,setDeleting]   = useState(false)
  const [saving,setSaving]       = useState(false)
  const [shopData,setShopData]   = useState(null)

  // Filters
  const [filterStatus,setFilterStatus]     = useState('')
  const [filterCustomer,setFilterCustomer] = useState('')
  const [dateFrom,setDateFrom]             = useState('')
  const [dateTo,setDateTo]                 = useState('')

  // Form
  const [form,setForm]   = useState({customer:'',notes:'',created_at:todayDate()})
  const [lines,setLines] = useState([{item:'',quantity:1}])

  // Multi-select
  const [selected,setSelected]       = useState(new Set())
  const [bulkDeleting,setBulkDeleting] = useState(false)
  const [confirmBulk,setConfirmBulk] = useState(false)

  const filterParams = useMemo(()=>{
    const p={}
    if(filterStatus)   p.status=filterStatus
    if(filterCustomer) p.customer=filterCustomer
    if(dateFrom)       p.date_from=dateFrom
    if(dateTo)         p.date_to=dateTo
    return p
  },[filterStatus,filterCustomer,dateFrom,dateTo])

  const loadBorrows = useCallback(()=>{
    setLoading(true)
    shopApi.getBorrows(filterParams).then(r=>{setBorrows(r.data.results??r.data);setSelected(new Set())}).finally(()=>setLoading(false))
  },[filterParams])

  const loadSummary = useCallback(()=>{
    setSummaryLoading(true)
    shopApi.getBorrowSummary(filterParams).then(r=>setSummary(r.data)).catch(()=>{}).finally(()=>setSummaryLoading(false))
  },[filterParams])

  useEffect(()=>{loadBorrows();loadSummary()},[loadBorrows,loadSummary])
  useEffect(()=>{
    authApi.getCustomers().then(r=>setCustomers(r.data.results??r.data))
    shopApi.getItems({is_active:true}).then(r=>setItems(r.data.results??r.data))
    shopApi.getSettings().then(r=>setShopData(r.data))
  },[])

  const customerOptions = useMemo(()=>customers.map(c=>({
    value:c.id, label:`${c.first_name} ${c.last_name}`.trim()||c.username,
    sub:`@${c.username}${c.phone_number?' · '+c.phone_number:''}`
  })),[customers])

  const itemOptions = useMemo(()=>items.map(it=>({value:it.id,label:it.name,sub:`₹${it.rate} per unit`})),[items])

  // Selection
  const allIds       = borrows.map(b=>b.id)
  const allSelected  = selected.size===allIds.length&&allIds.length>0
  const someSelected = selected.size>0&&!allSelected
  const toggleAll    = ()=>setSelected(allSelected?new Set():new Set(allIds))
  const toggleOne    = id=>setSelected(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n})

  const openCreate = ()=>{ setForm({customer:'',notes:'',created_at:todayDate()}); setLines([{item:'',quantity:1}]); setModal(true) }
  const addLine    = ()=>setLines(p=>[...p,{item:'',quantity:1}])
  const removeLine = i =>setLines(p=>p.filter((_,idx)=>idx!==i))
  const setLine    = (i,k,v)=>setLines(p=>p.map((l,idx)=>idx===i?{...l,[k]:v}:l))

  const handleSave = async e=>{
    e.preventDefault()
    if(!form.customer){toast.error('Select a customer');return}
    const validLines=lines.filter(l=>l.item&&l.quantity>0)
    if(!validLines.length){toast.error('Add at least one item');return}
    setSaving(true)
    try{
      await shopApi.createBorrow({customer:form.customer,notes:form.notes,
        created_at:form.created_at?`${form.created_at}T00:00:00`:undefined,
        items:validLines.map(l=>({item:l.item,quantity:Number(l.quantity)}))})
      toast.success('Entry created'); setModal(false); loadBorrows(); loadSummary()
    }catch(err){toast.error(err.response?.data?.detail||JSON.stringify(err.response?.data)||'Failed')}
    finally{setSaving(false)}
  }

  const handleDelete = async()=>{
    setDeleting(true)
    try{await shopApi.deleteBorrow(deleteTarget.id);toast.success('Deleted');setDeleteTarget(null);loadBorrows();loadSummary()}
    catch{toast.error('Failed')} finally{setDeleting(false)}
  }

  const handleBulkDelete = async()=>{
    setBulkDeleting(true)
    try{
      const res=await shopApi.bulkDeleteBorrows([...selected])
      toast.success(`${res.data.deleted} entr${res.data.deleted!==1?'ies':'y'} deleted`)
      setConfirmBulk(false); loadBorrows(); loadSummary()
    }catch{toast.error('Bulk delete failed')} finally{setBulkDeleting(false)}
  }

  const previewTotal=lines.reduce((sum,l)=>{
    const it=items.find(i=>String(i.id)===String(l.item))
    return sum+(it?Number(it.rate)*Number(l.quantity||0):0)
  },0)

  const hasFilters=filterStatus||filterCustomer||dateFrom||dateTo

  if(loading&&borrows.length===0) return <PageLoader/>

  return (
    <div className="space-y-5 max-w-5xl pb-24">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-xl font-bold text-slate-800">Borrow Entries</h1><p className="text-sm text-slate-400 mt-0.5">{borrows.length} shown</p></div>
        <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4"/>New Entry</button>
      </div>

      <div className="card !p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status:</span>
          {[['','All'],['pending','Pending'],['paid','Paid']].map(([s,l])=>(
            <button key={s} onClick={()=>setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus===s?'bg-indigo-600 text-white':'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Customer:</span>
          <div className="w-72">
            <SearchableSelect options={[{value:'',label:'All Customers'},...customerOptions]} value={filterCustomer} onChange={setFilterCustomer} placeholder="Filter by customer…"/>
          </div>
        </div>
        <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onClear={()=>{setDateFrom('');setDateTo('')}}/>
        {hasFilters&&<button onClick={()=>{setFilterStatus('');setFilterCustomer('');setDateFrom('');setDateTo('')}} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"><X className="w-3 h-3"/>Clear all</button>}
      </div>

      <SummaryBar borrowed={summary.total_borrowed} paid={summary.total_paid} due={summary.total_due} loading={summaryLoading}/>

      {borrows.length===0
        ? <EmptyState icon={ClipboardList} title="No borrow entries" description="Create one or adjust filters" action={<button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4"/>New Entry</button>}/>
        : (
          <div className="card !p-0 overflow-hidden">
            <TableWrapper>
              <thead>
                <tr>
                  <Th className="w-10"><SelectCheckbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll}/></Th>
                  <Th>Customer</Th><Th>Items</Th><Th>Borrowed</Th><Th>Date</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {borrows.map(b=>(
                  <tr key={b.id} className={`hover:bg-slate-50/50 cursor-pointer ${selected.has(b.id)?'bg-indigo-50/50':''}`} onClick={()=>setDetail(b)}>
                    <Td onClick={e=>e.stopPropagation()}><SelectCheckbox checked={selected.has(b.id)} onChange={()=>toggleOne(b.id)}/></Td>
                    <Td>
                      <p className="font-medium">{b.customer_name}</p>
                      {b.customer_phone&&<p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3"/>{b.customer_phone}</p>}
                    </Td>
                    <Td className="text-slate-500">{b.items?.length??0}</Td>
                    <Td className="font-semibold">{fmt(b.total_amount)}</Td>
                    <Td className="text-xs text-slate-400">{format(new Date(b.created_at),'dd MMM yyyy')}</Td>
                    <Td onClick={e=>e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={()=>setDeleteTarget(b)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
            <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 flex flex-wrap gap-6 items-center justify-end">
              <div className="flex items-center gap-2 text-sm"><span className="text-slate-500">Borrowed:</span><span className="font-bold">{fmt(summary.total_borrowed)}</span></div>
              <div className="flex items-center gap-2 text-sm"><span className="text-slate-500">Paid:</span><span className="font-bold text-green-700">{fmt(summary.total_paid)}</span></div>
              <div className="flex items-center gap-2 text-sm"><span className="text-slate-500">Due:</span><span className={`font-bold text-base ${Number(summary.total_due)>0?'text-red-600':'text-emerald-600'}`}>{fmt(summary.total_due)}</span></div>
            </div>
          </div>
        )
      }

      {/* Create modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title="New Borrow Entry" wide>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Customer *</label><SearchableSelect options={customerOptions} value={form.customer} onChange={v=>setForm(p=>({...p,customer:v}))} placeholder="Search customer…"/></div>
            <div><label className="label">Date</label><input className="input" type="date" value={form.created_at} onChange={e=>setForm(p=>({...p,created_at:e.target.value}))} max={todayDate()}/></div>
          </div>
          <div>
            <label className="label">Items *</label>
            <div className="space-y-2">
              {lines.map((line,i)=>{
                const selItem=items.find(it=>String(it.id)===String(line.item))
                return(
                  <div key={i} className="flex gap-2 items-center">
                    <div className="flex-1"><SearchableSelect options={itemOptions} value={line.item} onChange={v=>setLine(i,'item',v)} placeholder="Search item…"/></div>
                    <input type="number" min="1" className="input w-20" value={line.quantity} onChange={e=>setLine(i,'quantity',e.target.value)}/>
                    {selItem&&<span className="text-sm font-medium text-slate-500 w-24 text-right flex-shrink-0">{fmt(Number(selItem.rate)*Number(line.quantity))}</span>}
                    <button type="button" onClick={()=>removeLine(i)} className="p-1.5 text-slate-300 hover:text-red-500"><X className="w-4 h-4"/></button>
                  </div>
                )
              })}
            </div>
            <button type="button" className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1" onClick={addLine}><Plus className="w-3.5 h-3.5"/>Add item</button>
          </div>
          {previewTotal>0&&<div className="flex justify-end p-3 bg-slate-50 rounded-xl"><span className="text-sm font-semibold">Total: {fmt(previewTotal)}</span></div>}
          <div><label className="label">Notes</label><textarea className="input h-20 resize-none" value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Optional…"/></div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={()=>setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving?'Creating…':'Create Entry'}</button>
          </div>
        </form>
      </Modal>

      {/* Detail modal */}
      {detail&&(
        <Modal open={!!detail} onClose={()=>setDetail(null)} title={`Customer Name — ${detail.customer_name}`} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-400">Date</span><p className="font-medium mt-1">{format(new Date(detail.created_at),'dd MMM yyyy')}</p></div>
              <div><span className="text-slate-400">Borrowed</span><p className="font-semibold text-lg mt-1">{fmt(detail.total_amount)}</p></div>
              <div><span className="text-slate-400">Balance Due</span><p className={`font-semibold text-lg mt-1 ${Number(detail.balance_due)>0?'text-red-600':'text-green-600'}`}>{fmt(detail.balance_due)}</p></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Items</p>
              <div className="space-y-2">
                {detail.items?.map(li=>(
                  <div key={li.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    {li.item_image_url&&<img src={li.item_image_url} className="w-8 h-8 rounded-lg object-cover" onError={e=>e.target.style.display='none'}/>}
                    <div className="flex-1"><p className="text-sm font-medium">{li.item_name}</p><p className="text-xs text-slate-400">{li.quantity} × {fmt(li.rate_at_borrow)}</p></div>
                    <p className="text-sm font-semibold">{fmt(li.subtotal)}</p>
                  </div>
                ))}
              </div>
            </div>
            {detail.payments?.length>0&&(
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Payments</p>
                {detail.payments.map(p=>(
                  <div key={p.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0 text-sm">
                    <div>
                      <span className="text-slate-500">{p.method_display} · {format(new Date(p.paid_at),'dd MMM yyyy')}</span>
                    </div>
                    <span className="font-semibold">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleteTarget} onClose={()=>setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} title="Delete Entry" message={`Delete borrow #${deleteTarget?.id}? Removes all linked items and payments.`}/>
      <ConfirmDialog open={confirmBulk} onClose={()=>setConfirmBulk(false)} onConfirm={handleBulkDelete} loading={bulkDeleting}
        title={`Delete ${selected.size} Borrow ${selected.size!==1?'Entries':'Entry'}?`}
        message={`Permanently delete ${selected.size} borrow entr${selected.size!==1?'ies':'y'} and all linked items and payments?`}/>

      <BulkActionBar count={selected.size} label="entry" onDelete={()=>setConfirmBulk(true)} onClear={()=>setSelected(new Set())} deleting={bulkDeleting}/>
    </div>
  )
}