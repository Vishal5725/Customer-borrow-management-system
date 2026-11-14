import { useEffect, useState, useRef } from 'react'
import { authApi, shopApi } from '../../services/api'
import {
  Modal, PageLoader, EmptyState, FormField, ConfirmDialog,
  TableWrapper, Th, Td, SelectCheckbox, BulkActionBar
} from '../../components/UI'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Users, Upload, Download, AlertCircle, X, MessageCircle } from 'lucide-react'
import { format } from 'date-fns'

const EMPTY = { username: '', first_name: '', last_name: '', phone_number: '', password: '' }
const EMPTY_ROW = () => ({ username: '', first_name: '', last_name: '', phone_number: '', password: '', _id: Math.random() })

// ── CSV parser for customers ──────────────────────────────────────────────────
function parseCustomerCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  if (!lines.length) return { rows: [], errors: ['File is empty'] }

  const KNOWN = ['username','first_name','firstname','last_name','lastname','phone','phone_number','password','pass']
  const firstCells = lines[0].toLowerCase().split(',').map(c => c.trim().replace(/["']/g,''))
  const hasHeader  = firstCells.some(c => KNOWN.includes(c))
  let headers, dataLines

  if (hasHeader) { headers = firstCells; dataLines = lines.slice(1) }
  else           { headers = ['first_name','last_name','username','phone_number','password']; dataLines = lines }

  const col = {
    username:     headers.findIndex(h => h === 'username'),
    first_name:   headers.findIndex(h => ['first_name','firstname'].includes(h)),
    last_name:    headers.findIndex(h => ['last_name','lastname'].includes(h)),
    phone_number: headers.findIndex(h => ['phone','phone_number'].includes(h)),
    password:     headers.findIndex(h => ['password','pass'].includes(h)),
  }

  const rows = []; const errors = []
  dataLines.forEach((line, idx) => {
    const cells = []; let inQ = false, cur = ''
    for (const ch of line + ',') {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = '' }
      else cur += ch
    }
    const get = k => (col[k] >= 0 ? (cells[col[k]] ?? '').trim() : '')
    const username = get('username').toLowerCase().replace(/\s+/g,'_')
    const password = get('password')
    if (!username)       { errors.push(`Row ${idx+2}: username missing — skipped`); return }
    if (password.length < 6) { errors.push(`Row ${idx+2} "@${username}": password must be ≥6 chars — skipped`); return }
    rows.push({ username, first_name: get('first_name'), last_name: get('last_name'),
                phone_number: get('phone_number'), password, _id: Math.random() })
  })
  return { rows, errors }
}

function downloadCustomerTemplate() {
  const csv = ['# Bulk customer import template','username,first_name,last_name,phone_number,password',
    'ramesh_sharma,Ramesh,Sharma,+919876543210,pass123',
    'priya_v,Priya,Verma,+919812345678,pass456'].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = 'customers_template.csv'; a.click()
}

// ── BulkCustomerModal ─────────────────────────────────────────────────────────
function BulkCustomerModal({ open, onClose, onSuccess }) {
  const [rows, setRows]     = useState([EMPTY_ROW()])
  const [tab, setTab]       = useState('manual')
  const [csvText, setCsvText] = useState('')
  const [parseErrors, setParseErrors] = useState([])
  const [rowErrors, setRowErrors]     = useState({})
  const [preview, setPreview] = useState(null)
  const [saving, setSaving]   = useState(false)
  const fileRef = useRef(null)

  const reset = () => { setRows([EMPTY_ROW()]); setCsvText(''); setParseErrors([]); setRowErrors({}); setPreview(null); setSaving(false); setTab('manual') }
  const handleClose = () => { reset(); onClose() }

  const addRow     = () => setRows(r => [...r, EMPTY_ROW()])
  const removeRow  = i  => setRows(r => r.length === 1 ? [EMPTY_ROW()] : r.filter((_, idx) => idx !== i))
  const changeRow  = (i, upd) => setRows(r => r.map((row, idx) => idx === i ? upd : row))
  const setCell    = (i, k, v) => changeRow(i, { ...rows[i], [k]: v })

  const validate = () => {
    const errs = {}; const seen = new Set()
    rows.forEach((r, i) => {
      const u = r.username.trim()
      if (!u) { errs[i] = 'Username required'; return }
      if (r.password.length < 6) { errs[i] = 'Password ≥ 6 chars'; return }
      if (seen.has(u.toLowerCase())) { errs[i] = `Duplicate: @${u}` }
      seen.add(u.toLowerCase())
    })
    setRowErrors(errs)
    return !Object.keys(errs).length
  }

  const submit = async (sourceRows) => {
    setSaving(true)
    try {
      const payload = sourceRows.filter(r => r.username.trim() && r.password).map(r => ({
        username: r.username.trim().toLowerCase().replace(/\s+/g,'_'),
        first_name: r.first_name || '', last_name: r.last_name || '',
        phone_number: r.phone_number || '', password: r.password,
      }))
      if (!payload.length) { toast.error('No valid rows'); setSaving(false); return }
      const res = await authApi.bulkCreateCustomers(payload)
      toast.success(`✓ ${res.data.created} customer${res.data.created !== 1 ? 's' : ''} created`)
      onSuccess(); handleClose()
    } catch (err) {
      const d = err.response?.data
      const msg = d?.customers || d?.detail || Object.values(d || {}).flat().join(' ') || 'Failed'
      toast.error(typeof msg === 'string' ? msg : 'Validation error — check your data')
    } finally { setSaving(false) }
  }

  const handleFileUpload = e => {
    const file = e.target.files?.[0]; if (!file) return
    new FileReader().onload = ev => setCsvText(ev.target.result)
    new FileReader().readAsText(file)
    const r = new FileReader(); r.onload = ev => setCsvText(ev.target.result); r.readAsText(file)
    e.target.value = ''
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-600" /> Bulk Add Customers
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Add multiple customers at once</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500">✕</button>
        </div>

        <div className="flex border-b border-slate-100 px-6">
          {[['manual','📋 Manual Entry'],['csv','📄 CSV / Paste']].map(([k,l]) => (
            <button key={k} onClick={() => { setTab(k); setPreview(null); setParseErrors([]) }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${tab===k?'border-indigo-600 text-indigo-600':'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'manual' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500"><span className="font-medium">Username</span> and <span className="font-medium">Password</span> (≥6 chars) required.</p>
                <button type="button" onClick={addRow} className="btn-secondary !py-1.5 !text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Row</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[50vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <Th className="w-8">#</Th>
                      <Th>Username *</Th><Th>First Name</Th><Th>Last Name</Th>
                      <Th>Phone</Th><Th>Password *</Th><Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row._id} className={rowErrors[i] ? 'bg-red-50' : 'hover:bg-slate-50/50'}>
                        <Td className="text-xs text-slate-400 font-mono text-center">{i+1}</Td>
                        <Td>
                          <input className={`input !py-1.5 !text-sm w-32 ${rowErrors[i]?'border-red-300':''}`}
                            value={row.username} onChange={e => setCell(i,'username',e.target.value)} placeholder="@username" />
                          {rowErrors[i] && <p className="text-xs text-red-500 mt-0.5">{rowErrors[i]}</p>}
                        </Td>
                        <Td><input className="input !py-1.5 !text-sm w-28" value={row.first_name} onChange={e => setCell(i,'first_name',e.target.value)} placeholder="First" /></Td>
                        <Td><input className="input !py-1.5 !text-sm w-28" value={row.last_name}  onChange={e => setCell(i,'last_name', e.target.value)} placeholder="Last"  /></Td>
                        <Td><input className="input !py-1.5 !text-sm w-32" value={row.phone_number} onChange={e => setCell(i,'phone_number',e.target.value)} placeholder="+91…" /></Td>
                        <Td><input className="input !py-1.5 !text-sm w-28" type="password" value={row.password} onChange={e => setCell(i,'password',e.target.value)} placeholder="Min 6" /></Td>
                        <Td>
                          <button type="button" onClick={() => removeRow(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-400">{rows.filter(r=>r.username.trim()).length} / {rows.length} rows filled</p>
                <div className="flex gap-3">
                  <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
                  <button type="button" disabled={saving} onClick={() => { if (validate()) submit(rows) } }
                    className="btn-primary">{saving ? 'Creating…' : `Create ${rows.filter(r=>r.username.trim()&&r.password).length} Customers`}</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'csv' && !preview && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={downloadCustomerTemplate} className="btn-secondary !text-xs !py-1.5 flex items-center gap-1.5"><Download className="w-3.5 h-3.5"/> Download Template</button>
                <button type="button" onClick={() => fileRef.current?.click()}     className="btn-secondary !text-xs !py-1.5 flex items-center gap-1.5"><Upload className="w-3.5 h-3.5"/> Upload CSV</button>
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              </div>
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-600">Expected columns</p>
                <code className="bg-slate-200 px-1 rounded">username, first_name, last_name, phone_number, password</code>
                <p>Header optional. Password must be ≥ 6 characters.</p>
              </div>
              <textarea className="input h-48 resize-none font-mono text-xs" value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={'username,first_name,last_name,phone_number,password\nramesh_s,Ramesh,Sharma,+919876543210,secret123'} />
              {parseErrors.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1 mb-1"><AlertCircle className="w-3.5 h-3.5"/>{parseErrors.length} warning(s)</p>
                  <ul className="text-xs text-amber-600 list-disc list-inside space-y-0.5 max-h-20 overflow-y-auto">{parseErrors.map((e,i)=><li key={i}>{e}</li>)}</ul>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
                <button type="button" disabled={!csvText.trim()} className="btn-primary"
                  onClick={() => { const {rows:r,errors:e} = parseCustomerCSV(csvText); setParseErrors(e); if(r.length) setPreview(r); else toast.error('No valid rows') }}>
                  Preview →
                </button>
              </div>
            </div>
          )}

          {tab === 'csv' && preview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">✓ {preview.length} customers ready to create</p>
                <button type="button" onClick={() => setPreview(null)} className="text-xs text-indigo-600 hover:underline">← Edit CSV</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[45vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10"><tr><Th>#</Th><Th>Username</Th><Th>Name</Th><Th>Phone</Th></tr></thead>
                  <tbody>{preview.map((r,i)=>(
                    <tr key={r._id} className="hover:bg-slate-50/50">
                      <Td className="text-xs text-slate-400 font-mono">{i+1}</Td>
                      <Td className="font-mono text-sm">@{r.username}</Td>
                      <Td>{r.first_name} {r.last_name}</Td>
                      <Td className="text-slate-400">{r.phone_number||'—'}</Td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {parseErrors.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-600">
                  <p className="font-semibold mb-1">Skipped rows:</p>
                  <ul className="list-disc list-inside">{parseErrors.map((e,i)=><li key={i}>{e}</li>)}</ul>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
                <button type="button" onClick={() => submit(preview)} disabled={saving} className="btn-primary">
                  {saving ? 'Creating…' : `Create ${preview.length} Customers`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ── Main Customers page ───────────────────────────────────────────────────────
export default function AdminCustomers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [bulkModal, setBulkModal] = useState(false)
  const [form, setForm]           = useState(EMPTY)
  const [editId, setEditId]       = useState(null)
  const [saving, setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]   = useState(false)

  // Multi-select
  const [selected, setSelected]   = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmBulk, setConfirmBulk]   = useState(false)

  const load = () => authApi.getCustomers().then(r => { setCustomers(r.data.results ?? r.data); setSelected(new Set()) }).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const allIds      = customers.map(c => c.id)
  const allSelected = selected.size === allIds.length && allIds.length > 0
  const someSelected = selected.size > 0 && !allSelected
  const toggleAll   = () => setSelected(allSelected ? new Set() : new Set(allIds))
  const toggleOne   = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true) }
  const openEdit   = c => { setForm({ ...c, password: '' }); setEditId(c.id); setModal(true) }
  const closeModal = () => { setModal(false); setForm(EMPTY); setEditId(null) }
  const set        = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async e => {
    e.preventDefault()
    if (!form.username) { toast.error('Username is required'); return }
    if (!editId && !form.password) { toast.error('Password is required'); return }
    setSaving(true)
    const payload = { ...form }
    if (editId && !payload.password) delete payload.password
    try {
      editId ? await authApi.updateCustomer(editId, payload) : await authApi.createCustomer(payload)
      toast.success(editId ? 'Customer updated' : 'Customer created')
      closeModal(); load()
    } catch (err) {
      toast.error(Object.values(err.response?.data || {}).flat().join(' ') || 'Failed')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await authApi.deleteCustomer(deleteTarget.id); toast.success('Removed'); setDeleteTarget(null); load() }
    catch { toast.error('Failed') } finally { setDeleting(false) }
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    try {
      const res = await authApi.bulkDeleteCustomers([...selected])
      toast.success(`${res.data.deleted} customer${res.data.deleted !== 1 ? 's' : ''} removed`)
      setConfirmBulk(false); load()
    } catch { toast.error('Bulk delete failed') }
    finally { setBulkDeleting(false) }
  }

  const sendTotalDueReminder = async (c) => {
    const phone = (c.phone_number || '').replace(/\D/g, '')
    if (!phone) { toast.error('No phone number for this customer'); return }
    try {
      const res = await shopApi.getBorrowSummary({ customer: c.id })
      const due = Number(res.data.total_due)
      if (due <= 0) { toast('No pending due for this customer ✅'); return }
      const name = `${c.first_name} ${c.last_name}`.trim() || c.username
      const msg = `Hi ${name}, your total pending due amount is ₹${due.toLocaleString('en-IN')}. Please clear it at your earliest convenience. Thank you! 🙏`
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    } catch {
      toast.error('Could not fetch due amount')
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 max-w-5xl pb-24">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Customers</h1>
          <p className="text-sm text-slate-400 mt-0.5">{customers.length} registered</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setBulkModal(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Upload className="w-4 h-4" /> Bulk Add
          </button>
          <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add Customer</button>
        </div>
      </div>

      {customers.length === 0
        ? <EmptyState icon={Users} title="No customers yet" description="Add customers to start managing borrows"
            action={<div className="flex gap-2"><button className="btn-secondary" onClick={() => setBulkModal(true)}><Upload className="w-4 h-4"/>Bulk Add</button><button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4"/>Add Customer</button></div>} />
        : (
          <div className="card !p-0 overflow-hidden">
            <TableWrapper>
              <thead>
                <tr>
                  <Th className="w-10">
                    <SelectCheckbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                  </Th>
                  <Th>Name</Th><Th>Username</Th><Th>Phone</Th><Th>Joined</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className={`hover:bg-slate-50/50 ${selected.has(c.id) ? 'bg-indigo-50/50' : ''}`}>
                    <Td onClick={e => e.stopPropagation()}>
                      <SelectCheckbox checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} />
                    </Td>
                    <Td className="font-medium">{c.first_name} {c.last_name}</Td>
                    <Td className="text-slate-500">@{c.username}</Td>
                    <Td>{c.phone_number || <span className="text-slate-300">—</span>}</Td>
                    <Td className="text-xs text-slate-400">{c.date_joined ? format(new Date(c.date_joined),'dd MMM yyyy') : '—'}</Td>
                    <Td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2 flex-wrap">

                        {/* ── WhatsApp Remind button — always visible with text ── */}
                        {c.phone_number ? (
                          <button
                            onClick={() => sendTotalDueReminder(c)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 border border-green-200 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            Remind
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed">
                            <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            No phone
                          </span>
                        )}

                        {/* ── Edit button ── */}
                        <button
                          onClick={() => openEdit(c)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5 flex-shrink-0" />
                          Edit
                        </button>

                        {/* ── Delete button ── */}
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                          Delete
                        </button>

                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
          </div>
        )
      }

      {/* Single edit/create modal */}
      <Modal open={modal} onClose={closeModal} title={editId ? 'Edit Customer' : 'Add Customer'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name"><input className="input" value={form.first_name} onChange={e => set('first_name',e.target.value)} placeholder="Ramesh" /></FormField>
            <FormField label="Last Name"> <input className="input" value={form.last_name}  onChange={e => set('last_name', e.target.value)} placeholder="Sharma" /></FormField>
          </div>
          <FormField label="Username *"><input className="input" value={form.username} onChange={e => set('username',e.target.value)} placeholder="ramesh_sharma" /></FormField>
          <FormField label="Phone"><input className="input" type="tel" value={form.phone_number} onChange={e => set('phone_number',e.target.value)} placeholder="+91XXXXXXXXXX" /></FormField>
          <FormField label={editId ? 'New Password (leave blank to keep)' : 'Password *'}>
            <input className="input" type="password" value={form.password} onChange={e => set('password',e.target.value)} placeholder={editId ? '••••••••' : 'Min 6 chars'} />
          </FormField>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving…' : (editId ? 'Save Changes' : 'Create Customer')}</button>
          </div>
        </form>
      </Modal>

      <BulkCustomerModal open={bulkModal} onClose={() => setBulkModal(false)} onSuccess={load} />

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Remove Customer" message={`Remove "@${deleteTarget?.username}"? All their borrow entries will also be deleted.`} />

      <ConfirmDialog open={confirmBulk} onClose={() => setConfirmBulk(false)} onConfirm={handleBulkDelete} loading={bulkDeleting}
        title={`Delete ${selected.size} Customer${selected.size !== 1 ? 's' : ''}?`}
        message={`This will permanently delete ${selected.size} customer account${selected.size !== 1 ? 's' : ''} and all their borrow entries and payments. This cannot be undone.`} />

      <BulkActionBar count={selected.size} label="customer"
        onDelete={() => setConfirmBulk(true)} onClear={() => setSelected(new Set())} deleting={bulkDeleting} />
    </div>
  )
}