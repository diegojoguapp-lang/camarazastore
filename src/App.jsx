import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout, AdminLayout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Home } from './pages/Home'
import { Reventa } from './pages/Reventa'
import { Catalogo } from './pages/Catalogo'
import { ProductDetail } from './pages/ProductDetail'
import { Login } from './pages/Login'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { ProductList } from './pages/admin/ProductList'
import { ProductForm } from './pages/admin/ProductForm'

function Public({ children }) {
  return <Layout>{children}</Layout>
}
function Admin({ children }) {
  return <ProtectedRoute><AdminLayout>{children}</AdminLayout></ProtectedRoute>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Public><Home /></Public>} />
        <Route path="/reventa" element={<Public><Reventa /></Public>} />
        <Route path="/catalogo" element={<Public><Catalogo /></Public>} />
        <Route path="/producto/:slug" element={<Public><ProductDetail /></Public>} />
        <Route path="/login" element={<Public><Login /></Public>} />
        <Route path="/admin" element={<Admin><AdminDashboard /></Admin>} />
        <Route path="/admin/productos" element={<Admin><ProductList /></Admin>} />
        <Route path="/admin/productos/nuevo" element={<Admin><ProductForm /></Admin>} />
        <Route path="/admin/productos/:id/editar" element={<Admin><ProductForm /></Admin>} />
        <Route path="*" element={<Public><div className="page"><div className="container"><h1>Página no encontrada</h1></div></div></Public>} />
      </Routes>
    </BrowserRouter>
  )
}
