import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
const L = { dashboard: lazy(() => import('./pages/Dashboard.jsx')), pos: lazy(() => import('./pages/POS.jsx')), tables: lazy(() => import('./pages/Tables.jsx')), kitchen: lazy(() => import('./pages/Kitchen.jsx')), menu: lazy(() => import('./pages/Menu.jsx')), inventory: lazy(() => import('./pages/Inventory.jsx')), orders: lazy(() => import('./pages/Orders.jsx')), customers: lazy(() => import('./pages/Customers.jsx')), reports: lazy(() => import('./pages/Reports.jsx')), team: lazy(() => import('./pages/Team.jsx')), settings: lazy(() => import('./pages/Settings.jsx')) };
const M = ['owner', 'manager'];
export const NAV = [
  { to: '/', label: 'Overview', icon: 'LayoutDashboard', roles: M, el: 'dashboard' },
  { to: '/pos', label: 'POS Terminal', icon: 'ReceiptText', roles: [...M, 'cashier', 'waiter'], el: 'pos' },
  { to: '/tables', label: 'Tables', icon: 'Armchair', roles: [...M, 'cashier', 'waiter'], el: 'tables' },
  { to: '/kitchen', label: 'Kitchen Display', icon: 'ChefHat', roles: [...M, 'kitchen'], el: 'kitchen' },
  { to: '/menu', label: 'Menu', icon: 'UtensilsCrossed', roles: M, el: 'menu' },
  { to: '/inventory', label: 'Inventory', icon: 'Boxes', roles: M, el: 'inventory' },
  { to: '/orders', label: 'Orders', icon: 'ClipboardList', roles: [...M, 'cashier', 'waiter'], el: 'orders' },
  { to: '/customers', label: 'Customers', icon: 'Users', roles: [...M, 'cashier'], el: 'customers' },
  { to: '/reports', label: 'Reports', icon: 'BarChart3', roles: M, el: 'reports' },
  { to: '/team', label: 'Team', icon: 'UserCog', roles: M, el: 'team' },
  { to: '/settings', label: 'Settings', icon: 'Settings', roles: M, el: 'settings' },
];
export default function App() {
  const { loading, user } = useAuth();
  if (loading) return <div className="center-screen">Loading…</div>;
  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>;
  const allowed = NAV.filter((n) => n.roles.includes(user.role));
  return (
    <Layout nav={allowed}>
      <Suspense fallback={<div className="empty">Loading…</div>}>
        <Routes>
          {allowed.map((n) => { const P = L[n.el]; return <Route key={n.to} path={n.to} element={<P />} />; })}
          {!allowed.some((n) => n.to === '/') && <Route path="/" element={<Navigate to={allowed[0].to} replace />} />}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
