import { useEffect, useState, useRef, useCallback } from 'react'
import { shopApi } from '../../services/api'
import {
  Modal, PageLoader, EmptyState, FormField, ConfirmDialog,
  TableWrapper, Th, Td, SelectCheckbox, BulkActionBar
} from '../../components/UI'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Package, Search, Upload, Download, X, Check, AlertCircle, FileText } from 'lucide-react'

const EMPTY_ITEM = { name: '', rate: '', quantity: '', image_url: '', description: '', is_active: true }
const EMPTY_ROW  = () => ({ name: '', rate: '', quantity: '0', description: '', is_active: true, _id: Math.random() })
const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  if (!lines.length) return { rows: [], errors: ['File is empty'] }
  const KNOWN = ['name','rate','price','quantity','qty','description','desc','active','is_active']
  const firstCells = lines[0].toLowerCase().split(',').map(c => c.trim().replace(/["']/g,''))
  const hasHeader = firstCells.some(c => KNOWN.includes(c))
  let headers, dataLines
  if (hasHeader) { headers = firstCells; dataLines = lines.slice(1) }
  else           { headers = ['name','rate','quantity','description']; dataLines = lines }
  const colMap = {
    name:        headers.findIndex(h => h === 'name'),
    rate:        headers.findIndex(h => ['rate','price'].includes(h)),
    quantity:    headers.findIndex(h => ['quantity','qty'].includes(h)),
    description: headers.findIndex(h => ['description','desc'].includes(h)),
    is_active:   headers.findIndex(h => ['is_active','active'].includes(h)),
  }
  const rows = []; const errors = []
  dataLines.forEach((line, idx) => {
    const cells = []; let inQ = false, cur = ''
    for (const ch of line + ',') {
      if (ch === '"') { inQ = !inQ } else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = '' } else cur += ch
    }
    const get = k => (colMap[k] >= 0 ? (cells[colMap[k]] ?? '').trim() : '')
    const name = get('name'); const rate = get('rate').replace(/[₹,]/g,'')
    if (!name) { errors.push(`Row ${idx+2}: name empty — skipped`); return }
    if (!rate || isNaN(Number(rate))) { errors.push(`Row ${idx+2} "${name}": invalid rate — skipped`); return }
    const activeRaw = get('is_active').toLowerCase()
    rows.push({ name, rate, quantity: get('quantity') || '0', description: get('description'),
      is_active: activeRaw === '' || ['true','1','yes'].includes(activeRaw), _id: Math.random() })
  })
  return { rows, errors }
}

function exportCSV(items) {
  const header = 'name,rate,quantity,description,is_active'
  const body = items.map(i => [`"${i.name}"`,i.rate,i.quantity,`"${(i.description||'').replace(/"/g,'""')}"`,i.is_active].join(','))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([[header,...body].join('\n')],{type:'text/csv'}))
  a.download = 'items.csv'; a.click()
}

function downloadTemplate() {
  const csv = ['# Bulk import template','name,rate,quantity,description,is_active','"Basmati Rice 5kg",120,50,"Premium quality",true','"Wheat Flour 10kg",250,30,,true'].join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='items_template.csv'; a.click()
}

function BulkRow({ row, idx, onChange, onRemove, error }) {
  const set = (k,v) => onChange(idx,{...row,[k]:v})
  return (
    <tr className={error ? 'bg-red-50' : 'hover:bg-slate-50/50'}>
      <Td className="w-8 text-xs text-slate-400 font-mono text-center">{idx+1}</Td>
      <Td>
        <input className={`input !py-1.5 !text-sm w-full ${error?'border-red-300':''}`} value={row.name}
          onChange={e=>set('name',e.target.value)} placeholder="Item name *" />
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      </Td>
      <Td><input className="input !py-1.5 !text-sm w-24" type="number" min="0" value={row.rate} onChange={e=>set('rate',e.target.value)} placeholder="₹" /></Td>
      <Td><input className="input !py-1.5 !text-sm w-20" type="number" min="0" value={row.quantity} onChange={e=>set('quantity',e.target.value)} placeholder="0" /></Td>
      <Td><input className="input !py-1.5 !text-sm w-full" value={row.description} onChange={e=>set('description',e.target.value)} placeholder="Optional" /></Td>
      <Td className="text-center"><input type="checkbox" checked={row.is_active} onChange={e=>set('is_active',e.target.checked)} className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" /></Td>
      <Td><button type="button" onClick={()=>onRemove(idx)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button></Td>
    </tr>
  )
}

function BulkModal({ open, onClose, onSuccess }) {
  const [rows,setRows] = useState([EMPTY_ROW()])
  const [tab,setTab]   = useState('manual')
  const [csvText,setCsvText] = useState('')
  const [parseErrors,setParseErrors] = useState([])
  const [rowErrors,setRowErrors]     = useState({})
  const [preview,setPreview] = useState(null)
  const [saving,setSaving]   = useState(false)
  const fileRef = useRef(null)

  const reset = () => { setRows([EMPTY_ROW()]); setCsvText(''); setParseErrors([]); setRowErrors({}); setPreview(null); setSaving(false); setTab('manual') }
  const handleClose = () => { reset(); onClose() }

  const addRow    = () => setRows(r=>[...r,EMPTY_ROW()])
  const removeRow = i  => setRows(r=>r.length===1?[EMPTY_ROW()]:r.filter((_,idx)=>idx!==i))
  const changeRow = (i,upd) => setRows(r=>r.map((row,idx)=>idx===i?upd:row))

  const validate = () => {
    const errs={}; const seen=new Set()
    rows.forEach((r,i)=>{
      const n=r.name.trim(); const rt=r.rate.toString().trim()
      if (!n) { errs[i]='Name required'; return }
      if (!rt||isNaN(Number(rt))||Number(rt)<0) { errs[i]='Valid rate required'; return }
      if (seen.has(n.toLowerCase())) errs[i]=`Duplicate: "${n}"`
      seen.add(n.toLowerCase())
    })
    setRowErrors(errs); return !Object.keys(errs).length
  }

  const submit = async (sourceRows) => {
    setSaving(true)
    try {
      const payload = sourceRows.filter(r=>r.name.trim()&&r.rate.toString().trim()).map(r=>({
        name:r.name.trim(), rate:Number(r.rate), quantity:Number(r.quantity)||0,
        description:r.description||'', is_active:r.is_active!==false,
      }))
      if (!payload.length) { toast.error('No valid rows'); setSaving(false); return }
      const res = await shopApi.bulkCreateItems(payload)
      toast.success(`✓ ${res.data.created} added, ${res.data.updated} updated`)
      onSuccess(); handleClose()
    } catch (err) {
      const d=err.response?.data; toast.error(d?.detail||d?.items||JSON.stringify(d)||'Failed')
    } finally { setSaving(false) }
  }

  const handleFileUpload = e => {
    const file=e.target.files?.[0]; if(!file) return
    const r=new FileReader(); r.onload=ev=>setCsvText(ev.target.result); r.readAsText(file); e.target.value=''
  }

  const handlePaste = useCallback(e=>{
    const text=e.clipboardData?.getData('text'); if(!text||!text.includes('\t')) return
    e.preventDefault()
    setCsvText(text.split('\n').map(l=>l.split('\t').map(c=>`"${c.trim()}"`).join(',')).join('\n'))
    toast.success('Pasted from Excel — click "Preview Rows"')
  },[])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2"><Upload className="w-4 h-4 text-indigo-600"/>Bulk Add Items</h2>
            <p className="text-xs text-slate-400 mt-0.5">Add multiple items via spreadsheet or CSV</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500">✕</button>
        </div>
        <div className="flex border-b border-slate-100 px-6">
          {[['manual','📋 Manual'],['csv','📄 CSV / Paste']].map(([k,l])=>(
            <button key={k} onClick={()=>{setTab(k);setPreview(null);setParseErrors([])}}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab===k?'border-indigo-600 text-indigo-600':'border-transparent text-slate-500 hover:text-slate-700'}`}>{l}</button>
          ))}
        </div>
        <div className="p-6">
          {tab==='manual' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500"><b>Name</b> and <b>Rate</b> required.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={addRow} className="btn-secondary !py-1.5 !text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5"/>Add Row</button>
                  <button type="button" onClick={()=>setRows(r=>[...r,...Array.from({length:5},EMPTY_ROW)])} className="btn-secondary !py-1.5 !text-xs">+5 Rows</button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[55vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10"><tr><Th className="w-8">#</Th><Th>Name *</Th><Th>Rate *</Th><Th>Qty</Th><Th>Description</Th><Th className="text-center">Active</Th><Th/></tr></thead>
                  <tbody>{rows.map((row,i)=><BulkRow key={row._id} row={row} idx={i} onChange={changeRow} onRemove={removeRow} error={rowErrors[i]} />)}</tbody>
                </table>
              </div>
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-400">{rows.filter(r=>r.name.trim()).length}/{rows.length} filled</p>
                <div className="flex gap-3">
                  <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
                  <button type="button" onClick={()=>{if(validate())submit(rows)}} disabled={saving} className="btn-primary">
                    {saving?'Saving…':`Save ${rows.filter(r=>r.name.trim()&&r.rate.toString().trim()).length} Items`}
                  </button>
                </div>
              </div>
            </div>
          )}
          {tab==='csv'&&!preview&&(
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={downloadTemplate} className="btn-secondary !text-xs !py-1.5 flex items-center gap-1.5"><Download className="w-3.5 h-3.5"/>Template</button>
                <button type="button" onClick={()=>fileRef.current?.click()} className="btn-secondary !text-xs !py-1.5 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5"/>Upload CSV</button>
                <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFileUpload} />
              </div>
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-600">Format:</p>
                <code className="bg-slate-200 px-1 rounded">name,rate,quantity,description,is_active</code>
                <p>Paste from Excel/Sheets — tab-separated cells auto-converted.</p>
              </div>
              <textarea className="input h-52 resize-none font-mono text-xs" value={csvText}
                onChange={e=>setCsvText(e.target.value)} onPaste={handlePaste}
                placeholder={'"Basmati Rice",120,50,"Premium rice"\n"Wheat Flour",80,30,'} />
              {parseErrors.length>0&&<div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-600"><p className="font-semibold mb-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5"/>{parseErrors.length} warning(s)</p><ul className="list-disc list-inside">{parseErrors.map((e,i)=><li key={i}>{e}</li>)}</ul></div>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
                <button type="button" disabled={!csvText.trim()} className="btn-primary"
                  onClick={()=>{const{rows:r,errors:e}=parseCSV(csvText);setParseErrors(e);r.length?setPreview(r):toast.error('No valid rows')}}>
                  Preview Rows →
                </button>
              </div>
            </div>
          )}
          {tab==='csv'&&preview&&(
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700"><Check className="inline w-4 h-4 text-green-600 mr-1"/>{preview.length} rows parsed</p>
                <button type="button" onClick={()=>setPreview(null)} className="text-xs text-indigo-600 hover:underline">← Edit CSV</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[50vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10"><tr><Th>#</Th><Th>Name</Th><Th>Rate</Th><Th>Qty</Th><Th>Description</Th><Th className="text-center">Active</Th></tr></thead>
                  <tbody>{preview.map((r,i)=>(
                    <tr key={r._id} className="hover:bg-slate-50/50">
                      <Td className="text-xs text-slate-400 font-mono">{i+1}</Td>
                      <Td className="font-medium">{r.name}</Td>
                      <Td>{fmt(r.rate)}</Td><Td>{r.quantity}</Td>
                      <Td className="text-slate-400 text-xs max-w-xs truncate">{r.description||'—'}</Td>
                      <Td className="text-center">{r.is_active?<span className="badge bg-green-100 text-green-700">Active</span>:<span className="badge bg-slate-100 text-slate-500">Inactive</span>}</Td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700">
                ℹ️ Existing items with same name will be <strong>updated</strong>. New items will be created.
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
                <button type="button" onClick={()=>submit(preview)} disabled={saving} className="btn-primary">
                  {saving?'Saving…':`Confirm & Save ${preview.length} Items`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminItems() {
  const [items,setItems]       = useState([])
  const [loading,setLoading]   = useState(true)
  const [search,setSearch]     = useState('')
  const [modal,setModal]       = useState(false)
  const [bulkModal,setBulkModal] = useState(false)
  const [form,setForm]         = useState(EMPTY_ITEM)
  const [editId,setEditId]     = useState(null)
  const [saving,setSaving]     = useState(false)
  const [deleteTarget,setDeleteTarget] = useState(null)
  const [deleting,setDeleting] = useState(false)
  const [showInactive,setShowInactive] = useState(false)

  // Multi-select
  const [selected,setSelected]       = useState(new Set())
  const [bulkDeleting,setBulkDeleting] = useState(false)
  const [confirmBulk,setConfirmBulk] = useState(false)

  const load = () => shopApi.getItems({search}).then(r=>{setItems(r.data.results??r.data);setSelected(new Set())}).finally(()=>setLoading(false))
  useEffect(()=>{load()},[search,showInactive])

  const allIds       = items.map(i=>i.id)
  const allSelected  = selected.size===allIds.length&&allIds.length>0
  const someSelected = selected.size>0&&!allSelected
  const toggleAll    = ()=>setSelected(allSelected?new Set():new Set(allIds))
  const toggleOne    = id=>setSelected(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n})

  const openCreate = ()=>{setForm(EMPTY_ITEM);setEditId(null);setModal(true)}
  const openEdit   = item=>{setForm({...item,rate:String(item.rate)});setEditId(item.id);setModal(true)}
  const closeModal = ()=>{setModal(false);setForm(EMPTY_ITEM);setEditId(null)}
  const set        = (k,v)=>setForm(p=>({...p,[k]:v}))

  const handleSave = async e => {
    e.preventDefault()
    if (!form.name||!form.rate){toast.error('Name and rate required');return}
    setSaving(true)
    try { editId?await shopApi.updateItem(editId,form):await shopApi.createItem(form); toast.success(editId?'Updated':'Added'); closeModal();load() }
    catch(err){toast.error(err.response?.data?.detail||'Failed')} finally{setSaving(false)}
  }

  const handleDelete = async ()=>{
    setDeleting(true)
    try{await shopApi.deleteItem(deleteTarget.id);toast.success('Deleted');setDeleteTarget(null);load()}
    catch{toast.error('Failed')} finally{setDeleting(false)}
  }

  const handleBulkDelete = async ()=>{
    setBulkDeleting(true)
    try{
      const res=await shopApi.bulkDeleteItems([...selected])
      toast.success(`${res.data.deleted} item${res.data.deleted!==1?'s':''} deleted`)
      setConfirmBulk(false);load()
    }catch{toast.error('Bulk delete failed')} finally{setBulkDeleting(false)}
  }

  const displayItems = showInactive ? items : items.filter(i=>i.is_active)

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 max-w-5xl pb-24">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Items</h1>
          <p className="text-sm text-slate-400 mt-0.5">{items.filter(i=>i.is_active).length} active · {items.filter(i=>!i.is_active).length} inactive</p>
        </div>
        <div className="flex gap-2">
          {items.length>0&&<button onClick={()=>exportCSV(items)} className="btn-secondary !py-2 text-sm flex items-center gap-1.5"><Download className="w-4 h-4"/>Export</button>}
          <button onClick={()=>setBulkModal(true)} className="btn-secondary !py-2 text-sm flex items-center gap-1.5"><Upload className="w-4 h-4"/>Bulk Add</button>
          <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4"/>Add Item</button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search items…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-500 select-none">
          <input type="checkbox" className="rounded accent-indigo-600" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)} />Show inactive
        </label>
      </div>

      {displayItems.length===0
        ? <EmptyState icon={Package} title="No items" description="Add items individually or use Bulk Add"
            action={<div className="flex gap-2"><button className="btn-secondary" onClick={()=>setBulkModal(true)}><Upload className="w-4 h-4"/>Bulk Add</button><button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4"/>Add Item</button></div>} />
        : (
          <div className="card !p-0 overflow-hidden">
            <TableWrapper>
              <thead>
                <tr>
                  <Th className="w-10"><SelectCheckbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll}/></Th>
                  <Th>Name</Th><Th>Rate</Th><Th>Qty</Th><Th>Status</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map(item=>(
                  <tr key={item.id} className={`hover:bg-slate-50/50 ${selected.has(item.id)?'bg-indigo-50/50':''}`}>
                    <Td onClick={e=>e.stopPropagation()}><SelectCheckbox checked={selected.has(item.id)} onChange={()=>toggleOne(item.id)}/></Td>
                    <Td>
                      <p className="font-medium">{item.name}</p>
                      {item.description&&<p className="text-xs text-slate-400 truncate max-w-xs">{item.description}</p>}
                    </Td>
                    <Td className="font-semibold">{fmt(item.rate)}</Td>
                    <Td>{item.quantity}</Td>
                    <Td><span className={`badge ${item.is_active?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}`}>{item.is_active?'Active':'Inactive'}</span></Td>
                    <Td onClick={e=>e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>openEdit(item)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                        <button onClick={()=>setDeleteTarget(item)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
          </div>
        )
      }

      <Modal open={modal} onClose={closeModal} title={editId?'Edit Item':'Add New Item'}>
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Item Name *"><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Basmati Rice 5kg"/></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Rate (₹) *"><input className="input" type="number" min="0" step="1" value={form.rate} onChange={e=>set('rate',e.target.value)} placeholder="0"/></FormField>
            <FormField label="Quantity"><input className="input" type="number" min="0" value={form.quantity} onChange={e=>set('quantity',e.target.value)} placeholder="0"/></FormField>
          </div>
          <FormField label="Description"><textarea className="input h-20 resize-none" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Optional…"/></FormField>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="rounded" checked={form.is_active} onChange={e=>set('is_active',e.target.checked)}/>
            <span className="text-sm text-slate-600">Active (visible to customers)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving?'Saving…':(editId?'Save Changes':'Add Item')}</button>
          </div>
        </form>
      </Modal>

      <BulkModal open={bulkModal} onClose={()=>setBulkModal(false)} onSuccess={load}/>
      <ConfirmDialog open={!!deleteTarget} onClose={()=>setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} title="Delete Item" message={`Delete "${deleteTarget?.name}"? Cannot be undone.`}/>
      <ConfirmDialog open={confirmBulk} onClose={()=>setConfirmBulk(false)} onConfirm={handleBulkDelete} loading={bulkDeleting}
        title={`Delete ${selected.size} Item${selected.size!==1?'s':''}?`}
        message={`Permanently delete ${selected.size} item${selected.size!==1?'s':''}? Borrow entries referencing these items will be affected.`}/>

      <BulkActionBar count={selected.size} label="item" onDelete={()=>setConfirmBulk(true)} onClear={()=>setSelected(new Set())} deleting={bulkDeleting}/>
    </div>
  )
}