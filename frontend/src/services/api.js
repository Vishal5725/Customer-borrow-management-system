import axios from 'axios'

const BASE_URL = import.meta.env.API_URL || '/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let queue = []

const processQueue = (error, token = null) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)))
  queue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }
      original._retry = true
      isRefreshing = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        if (!refresh) throw new Error('No refresh token')
        const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh })
        localStorage.setItem('access_token', data.access)
        api.defaults.headers.common.Authorization = `Bearer ${data.access}`
        processQueue(null, data.access)
        return api(original)
      } catch (err) {
        processQueue(err, null)
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login:               (data)    => api.post('/auth/login/', data),
  logout:              (refresh) => api.post('/auth/logout/', { refresh }),
  me:                  ()        => api.get('/auth/me/'),

  // Customers — single
  getCustomers:        ()        => api.get('/auth/customers/'),
  createCustomer:      (data)    => api.post('/auth/customers/', data),
  updateCustomer:      (id, data)=> api.patch(`/auth/customers/${id}/`, data),
  deleteCustomer:      (id)      => api.delete(`/auth/customers/${id}/`),

  // Customers — bulk
  bulkCreateCustomers: (customers) => api.post('/auth/customers/bulk/', { customers }),
  bulkDeleteCustomers: (ids)       => api.delete('/auth/customers/bulk-delete/', { data: { ids } }),
}

// ── Shop ──────────────────────────────────────────────────────────────────────
export const shopApi = {
  // Items — single
  getItems:           (params)    => api.get('/shop/items/', { params }),
  createItem:         (data)      => api.post('/shop/items/', data),
  updateItem:         (id, data)  => api.patch(`/shop/items/${id}/`, data),
  deleteItem:         (id)        => api.delete(`/shop/items/${id}/`),
  // Items — bulk
  bulkCreateItems:    (items)     => api.post('/shop/items/bulk/', { items }),
  bulkDeleteItems:    (ids)       => api.delete('/shop/items/bulk-delete/', { data: { ids } }),

  // Borrows — single
  getBorrows:         (params)    => api.get('/shop/borrows/', { params }),
  getBorrow:          (id)        => api.get(`/shop/borrows/${id}/`),
  updateBorrow:     (id, data) => api.put(`/shop/borrows/${id}/`, data),
  patchBorrow:      (id, data) => api.patch(`/shop/borrows/${id}/`, data),
  createBorrow:       (data)      => api.post('/shop/borrows/', data),
  deleteBorrow:       (id)        => api.delete(`/shop/borrows/${id}/`),
  getBorrowSummary:   (params)    => api.get('/shop/borrows/summary/', { params }),
  // Borrows — bulk
  bulkDeleteBorrows:  (ids)       => api.delete('/shop/borrows/bulk-delete/', { data: { ids } }),

  // Payments — single
  getPayments:        (params)    => api.get('/shop/payments/', { params }),
  createPayment:      (data)      => api.post('/shop/payments/', data),
  verifyPayment:      (id, data)  => api.post(`/shop/payments/${id}/verify/`, data),
  // Payments — bulk (verified only)
  bulkDeletePayments: (ids)       => api.delete('/shop/payments/bulk-delete/', { data: { ids } }),

  // Dashboards
  adminDashboard:     ()          => api.get('/shop/dashboard/admin/'),
  customerDashboard:  ()          => api.get('/shop/dashboard/customer/'),

  // Settings
  getSettings:        ()          => api.get('/shop/settings/'),
  updateSettings:     (data)      => api.put('/shop/settings/', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
}

export default api