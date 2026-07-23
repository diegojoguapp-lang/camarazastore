import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout, AdminLayout } from './components/Layout'
import { AdminRoute, ResellerRoute } from './components/ProtectedRoute'

function lazyNamed(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })))
}

const Home = lazyNamed(() => import('./pages/Home'), 'Home')
const Reventa = lazyNamed(() => import('./pages/Reventa'), 'Reventa')
const Catalogo = lazyNamed(() => import('./pages/Catalogo'), 'Catalogo')
const ProductDetail = lazyNamed(() => import('./pages/ProductDetail'), 'ProductDetail')
const Login = lazyNamed(() => import('./pages/Login'), 'Login')
const PasswordRecovery = lazyNamed(() => import('./pages/PasswordRecovery'), 'PasswordRecovery')
const UpdatePassword = lazyNamed(() => import('./pages/UpdatePassword'), 'UpdatePassword')
const Reglas = lazyNamed(() => import('./pages/Reglas'), 'Reglas')
const Ayuda = lazyNamed(() => import('./pages/Ayuda'), 'Ayuda')
const Materiales = lazyNamed(() => import('./pages/Materiales'), 'Materiales')
const Redes = lazyNamed(() => import('./pages/Redes'), 'Redes')

const AdminDashboard = lazyNamed(() => import('./pages/admin/AdminDashboard'), 'AdminDashboard')
const ProductList = lazyNamed(() => import('./pages/admin/ProductList'), 'ProductList')
const ProductForm = lazyNamed(() => import('./pages/admin/ProductForm'), 'ProductForm')
const HelpVideosAdmin = lazyNamed(() => import('./pages/admin/HelpVideosAdmin'), 'HelpVideosAdmin')
const SocialLinksAdmin = lazyNamed(() => import('./pages/admin/SocialLinksAdmin'), 'SocialLinksAdmin')
const ResellersAdmin = lazyNamed(() => import('./pages/admin/ResellersAdmin'), 'ResellersAdmin')
const AdminSecurity = lazyNamed(() => import('./pages/admin/AdminSecurity'), 'AdminSecurity')
const SalesAdmin = lazyNamed(() => import('./pages/admin/SalesAdmin'), 'SalesAdmin')
const SaleForm = lazyNamed(() => import('./pages/admin/SaleForm'), 'SaleForm')
const SaleDetail = lazyNamed(() => import('./pages/admin/SaleDetail'), 'SaleDetail')
const CustomersAdmin = lazyNamed(() => import('./pages/admin/CustomersAdmin'), 'CustomersAdmin')
const CustomerDetail = lazyNamed(() => import('./pages/admin/CustomerDetail'), 'CustomerDetail')
const CommissionsAdmin = lazyNamed(() => import('./pages/admin/CommissionsAdmin'), 'CommissionsAdmin')
const CommissionBatchDetail = lazyNamed(() => import('./pages/admin/CommissionBatchDetail'), 'CommissionBatchDetail')
const CommissionPaymentForm = lazyNamed(() => import('./pages/admin/CommissionPaymentForm'), 'CommissionPaymentForm')
const CommissionPaymentDetail = lazyNamed(() => import('./pages/admin/CommissionPaymentDetail'), 'CommissionPaymentDetail')

const PanelHome = lazyNamed(() => import('./pages/panel/PanelHome'), 'PanelHome')
const PanelSales = lazyNamed(() => import('./pages/panel/PanelSales'), 'PanelSales')
const BankAccount = lazyNamed(() => import('./pages/panel/BankAccount'), 'BankAccount')
const PanelPayments = lazyNamed(() => import('./pages/panel/PanelPayments'), 'PanelPayments')
const PanelPaymentDetail = lazyNamed(() => import('./pages/panel/PanelPaymentDetail'), 'PanelPaymentDetail')
const PanelSaleDetail = lazyNamed(() => import('./pages/panel/PanelSaleDetail'), 'PanelSaleDetail')
const PanelProgress = lazyNamed(() => import('./pages/panel/PanelProgress'), 'PanelProgress')
const PanelPerformance = lazyNamed(() => import('./pages/panel/PanelPerformance'), 'PanelPerformance')
const PanelAchievements = lazyNamed(() => import('./pages/panel/PanelAchievements'), 'PanelAchievements')
const PanelProfile = lazyNamed(() => import('./pages/panel/PanelProfile'), 'PanelProfile')

function Public({ children }) {
  return <Layout>{children}</Layout>
}
function Admin({ children }) {
  return <AdminRoute><AdminLayout>{children}</AdminLayout></AdminRoute>
}
function Panel({ children }) {
  return <ResellerRoute>{children}</ResellerRoute>
}

function RouteFallback() {
  return <div className="page"><div className="container"><div className="ds-skeleton-card"><span /><strong /><p /></div></div></div>
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
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
          <Route path="/panel/ventas/:id" element={<Panel><PanelSaleDetail /></Panel>} />
          <Route path="/panel/cuenta-bancaria" element={<Panel><BankAccount /></Panel>} />
          <Route path="/panel/pagos" element={<Panel><PanelPayments /></Panel>} />
          <Route path="/panel/pagos/:id" element={<Panel><PanelPaymentDetail /></Panel>} />
          <Route path="/panel/progreso" element={<Panel><PanelProgress /></Panel>} />
          <Route path="/panel/rendimiento" element={<Panel><PanelPerformance /></Panel>} />
          <Route path="/panel/logros" element={<Panel><PanelAchievements /></Panel>} />
          <Route path="/panel/perfil" element={<Panel><PanelProfile /></Panel>} />
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
          <Route path="*" element={<Public><div className="page"><div className="container"><h1>Pagina no encontrada</h1></div></div></Public>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
