import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout, AdminLayout } from './components/Layout'
import { AdminRoute, ResellerRoute } from './components/ProtectedRoute'
import { Home } from './pages/Home'
import { Reventa } from './pages/Reventa'
import { Catalogo } from './pages/Catalogo'
import { ProductDetail } from './pages/ProductDetail'
import { Login } from './pages/Login'
import { PasswordRecovery } from './pages/PasswordRecovery'
import { UpdatePassword } from './pages/UpdatePassword'
import { Reglas } from './pages/Reglas'
import { Ayuda } from './pages/Ayuda'
import { Materiales } from './pages/Materiales'
import { Redes } from './pages/Redes'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { ProductList } from './pages/admin/ProductList'
import { ProductForm } from './pages/admin/ProductForm'
import { HelpVideosAdmin } from './pages/admin/HelpVideosAdmin'
import { SocialLinksAdmin } from './pages/admin/SocialLinksAdmin'
import { ResellersAdmin } from './pages/admin/ResellersAdmin'
import { AdminSecurity } from './pages/admin/AdminSecurity'
import { SalesAdmin } from './pages/admin/SalesAdmin'
import { SaleForm } from './pages/admin/SaleForm'
import { SaleDetail } from './pages/admin/SaleDetail'
import { CustomersAdmin } from './pages/admin/CustomersAdmin'
import { CustomerDetail } from './pages/admin/CustomerDetail'
import { CommissionsAdmin } from './pages/admin/CommissionsAdmin'
import { CommissionBatchDetail } from './pages/admin/CommissionBatchDetail'
import { CommissionPaymentForm } from './pages/admin/CommissionPaymentForm'
import { CommissionPaymentDetail } from './pages/admin/CommissionPaymentDetail'
import { PanelHome } from './pages/panel/PanelHome'
import { PanelSales } from './pages/panel/PanelSales'
import { BankAccount } from './pages/panel/BankAccount'
import { PanelPayments } from './pages/panel/PanelPayments'
import { PanelPaymentDetail } from './pages/panel/PanelPaymentDetail'

function Public({ children }) {
  return <Layout>{children}</Layout>
}
function Admin({ children }) {
  return <AdminRoute><AdminLayout>{children}</AdminLayout></AdminRoute>
}
function Panel({ children }) {
  return <ResellerRoute>{children}</ResellerRoute>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reventa" element={<Public><Reventa /></Public>} />
        <Route path="/catalogo" element={<Public><Catalogo /></Public>} />
        <Route path="/producto/:slug" element={<Public><ProductDetail /></Public>} />
        <Route path="/materiales" element={<Public><Materiales /></Public>} />
        <Route path="/ayuda" element={<Public><Ayuda /></Public>} />
        <Route path="/reglas" element={<Public><Reglas /></Public>} />
        <Route path="/redes" element={<Public><Redes /></Public>} />
        <Route path="/login" element={<Public><Login /></Public>} />
        <Route path="/recuperar-contrasena" element={<Public><PasswordRecovery /></Public>} />
        <Route path="/actualizar-contrasena" element={<Public><UpdatePassword /></Public>} />
        <Route path="/panel" element={<Panel><PanelHome /></Panel>} />
        <Route path="/panel/ventas" element={<Panel><PanelSales /></Panel>} />
        <Route path="/panel/cuenta-bancaria" element={<Panel><BankAccount /></Panel>} />
        <Route path="/panel/pagos" element={<Panel><PanelPayments /></Panel>} />
        <Route path="/panel/pagos/:id" element={<Panel><PanelPaymentDetail /></Panel>} />
        <Route path="/admin" element={<Admin><AdminDashboard /></Admin>} />
        <Route path="/admin/productos" element={<Admin><ProductList /></Admin>} />
        <Route path="/admin/productos/nuevo" element={<Admin><ProductForm /></Admin>} />
        <Route path="/admin/productos/:id/editar" element={<Admin><ProductForm /></Admin>} />
        <Route path="/admin/ventas" element={<Admin><SalesAdmin /></Admin>} />
        <Route path="/admin/ventas/nueva" element={<Admin><SaleForm /></Admin>} />
        <Route path="/admin/ventas/:id" element={<Admin><SaleDetail /></Admin>} />
        <Route path="/admin/ventas/:id/editar" element={<Admin><SaleForm /></Admin>} />
        <Route path="/admin/clientes" element={<Admin><CustomersAdmin /></Admin>} />
        <Route path="/admin/clientes/:id" element={<Admin><CustomerDetail /></Admin>} />
        <Route path="/admin/comisiones" element={<Admin><CommissionsAdmin /></Admin>} />
        <Route path="/admin/comisiones/:id" element={<Admin><CommissionBatchDetail /></Admin>} />
        <Route path="/admin/comisiones/:batchId/pagar/:resellerId" element={<Admin><CommissionPaymentForm /></Admin>} />
        <Route path="/admin/comisiones/pagos/:id" element={<Admin><CommissionPaymentDetail /></Admin>} />
        <Route path="/admin/videos" element={<Admin><HelpVideosAdmin /></Admin>} />
        <Route path="/admin/redes" element={<Admin><SocialLinksAdmin /></Admin>} />
        <Route path="/admin/revendedores" element={<Admin><ResellersAdmin /></Admin>} />
        <Route path="/admin/seguridad" element={<Admin><AdminSecurity /></Admin>} />
        <Route path="*" element={<Public><div className="page"><div className="container"><h1>Página no encontrada</h1></div></div></Public>} />
      </Routes>
    </BrowserRouter>
  )
}
