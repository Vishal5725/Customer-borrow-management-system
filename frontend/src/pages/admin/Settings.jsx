import { useEffect, useState, useRef } from 'react'
import { shopApi } from '../../services/api'
import { PageLoader } from '../../components/UI'
import toast from 'react-hot-toast'
import { Settings, Save } from 'lucide-react'

export default function AdminSettings() {
  const [form, setForm] = useState({ shop_name: '', whatsapp_number: '', upi_qr_image: '' })
  const [qrFile, setQrFile] = useState(null)       // ✅ store raw File object
  const [qrPreview, setQrPreview] = useState('')   // ✅ separate preview URL
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    shopApi.getSettings().then(r => {
      setForm(r.data)
      if (r.data.upi_qr_image) setQrPreview(r.data.upi_qr_image) // existing image URL from backend
    }).finally(() => setLoading(false))
  }, [])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setQrFile(file)                                  // ✅ keep File for upload
    setQrPreview(URL.createObjectURL(file))          // ✅ local preview
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      // ✅ Use FormData for multipart/form-data encoding
      const formData = new FormData()
      formData.append('shop_name', form.shop_name)
      formData.append('whatsapp_number', form.whatsapp_number)
      if (qrFile) {
        formData.append('upi_qr_image', qrFile)     // ✅ attach real File object
      }
      await shopApi.updateSettings(formData)         // send FormData, not plain object
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  if (loading) return <PageLoader />

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
          <Settings className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Settings</h1>
          <p className="text-sm text-slate-400">Shop configuration &amp; payment details</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Shop Info</h2>
          <div>
            <label className="label">Shop Name</label>
            <input className="input" value={form.shop_name} onChange={e => set('shop_name', e.target.value)} placeholder="My Shop" />
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Payment Details</h2>
          <div>
            <label className="label">WhatsApp Number</label>
            <input className="input" type="tel" value={form.whatsapp_number} onChange={e => set('whatsapp_number', e.target.value)} placeholder="+91XXXXXXXXXX" />
            <p className="text-xs text-slate-400 mt-1">Customers will be asked to send payment screenshots to this number.</p>
          </div>
          <div>
            <label className="label">UPI QR Code Image</label>
            <input className="input" type="file" accept="image/*" onChange={handleFileChange} />
            <p className="text-xs text-slate-400 mt-1">Upload your Google Pay / PhonePe / UPI QR code image.</p>
          </div>
          {qrPreview && (
            <div>
              <p className="label">QR Preview</p>
              <img src={qrPreview} alt="QR Preview" className="w-40 h-40 object-contain rounded-xl border border-slate-200"
                onError={e => { e.target.style.display = 'none' }} />
            </div>
          )}
        </div>

        <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
          <Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}