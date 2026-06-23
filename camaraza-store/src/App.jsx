import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ToastProvider } from './components/Toast'

import PublicLayout from './components/PublicLayout'
import Home from './pages/Home'
import Reventa from './pages/Reventa'
import Catalogo from './pages/Catalogo'
import Producto from './pages/Producto'

import Login from './admin/Login'
import AdminLayout, { RequireAuth } from './admin/AdminLayout'
import Dashboard from './admin/Dashboard'
import ProductList from './admin/ProductList'
import ProductForm from './admin/ProductForm'

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Público */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/reventa" element={<Reventa />} />
              <Route path="/catalogo" element={<Catalogo />} />
              <Route path="/producto/:slug" element={<Producto />} />
            </Route>

            {/* Auth */}
            <Route path="/login" element={<Login />} />

            {/* Admin protegido */}
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="productos" element={<ProductList />} />
              <Route path="productos/nuevo" element={<ProductForm />} />
              <Route path="productos/:id/editar" element={<ProductForm />} />
            </Route>

            {/* 404 -> home */}
            <Route path="*" element={<Home />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
