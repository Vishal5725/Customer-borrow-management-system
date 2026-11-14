import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import AdminLayout from './components/AdminLayout'
import CustomerLayout from './components/CustomerLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminItems from './pages/admin/Items'
import AdminCustomers from './pages/admin/Customers'
import AdminBorrows from './pages/admin/Borrows'
import AdminPayments from './pages/admin/Payments'
import AdminSettings from './pages/admin/Settings'
import CustomerDashboard from './pages/customer/Dashboard'
import CustomerBorrows from './pages/customer/Borrows'
import CustomerPayments from './pages/customer/Payments'

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/customer'} replace />
  return children
}

function Spinner() {
  return (
    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to={user.role === 'admin' ? '/admin' : '/customer'} replace /> : <Login />
      } />

      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="items" element={<AdminItems />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="borrows" element={<AdminBorrows />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* Customer routes */}
      <Route path="/customer" element={
        <ProtectedRoute role="customer"><CustomerLayout /></ProtectedRoute>
      }>
        <Route index element={<CustomerDashboard />} />
        <Route path="borrows" element={<CustomerBorrows />} />
        <Route path="payments" element={<CustomerPayments />} />
      </Route>

      <Route path="*" element={
        user
          ? <Navigate to={user.role === 'admin' ? '/admin' : '/customer'} replace />
          : <Navigate to="/login" replace />
      } />
    </Routes>
  )
}
