import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Welcome, { SignupInfo } from './pages/Welcome.jsx';
import NotFound from './pages/NotFound.jsx';
const L = { dashboard: lazy(() => import('./pages/Dashboard.jsx')), pos: lazy(() => import('./pages/POS.jsx')), tables: lazy(() => import('./pages/Tables.jsx')), kitchen: lazy(() => import('./pages/Kitchen.jsx')), menu: lazy(() => import('./pages/Menu.jsx')), inventory: lazy(() => import('./pages/Inventory.jsx')), orders: lazy(() => import('./pages/Orders.jsx')), customers: lazy(() => import('./pages/Customers.jsx')), reports: lazy(() => import('./pages/Reports.jsx')), team: lazy(() => import('./pages/Team.jsx')), settings: lazy(() => import('./pages/Settings.jsx')) };
const M = ['owner', 'manager'];
function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-screen__spinner" aria-hidden="true" />
      <p>Loading…</p>
    </div>
  );
}
function SplashScreen() {
  return (
    <div className="splash-screen" role="status" aria-label="Starting Servora">
      <div className="splash-screen__mark">S</div>
      <p className="splash-screen__brand">SERVORA</p>
      <p className="splash-screen__tagline">Made for gracious service</p>
      <span className="splash-screen__glow" aria-hidden="true" />
      <p className="splash-screen__footer">
        Made with <Heart size={14} fill="currentColor" aria-hidden="true" /> by Pakiza Aleem
      </p>
    </div>
  );
}
export const NAV = [
  { to: '/dashboard', label: 'Overview', icon: 'LayoutDashboard', roles: M, el: 'dashboard' },
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
  const location = useLocation();
  const [splashDone, setSplashDone] = useState(() => {
    const navigationType = window.performance?.getEntriesByType?.('navigation')?.[0]?.type;
    const initialLoad = !navigationType || navigationType === 'navigate';
    const authPageRefresh =
      navigationType === 'reload' && ['/login', '/signup'].includes(window.location.pathname);
    return !(initialLoad || authPageRefresh);
  });
  useEffect(() => {
    if (splashDone) return undefined;
    const timer = window.setTimeout(() => setSplashDone(true), 4000);
    return () => window.clearTimeout(timer);
  }, [splashDone]);
  if (!splashDone) return <SplashScreen />;
  if (loading) return <LoadingScreen />;
  if (!user) return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignupInfo />} />
      <Route path="*" element={<Login />} />
    </Routes>
  );
  const allowed = NAV.filter((n) => n.roles.includes(user.role));
  if (location.pathname === '/') return <Welcome />;
  if (location.pathname === '/login') return <Navigate to="/app" replace />;
  if (location.pathname === '/signup') return <Navigate to="/app" replace />;
  if (location.pathname === '/app') return <Navigate to={allowed[0].to} replace />;
  return (
    <Layout nav={allowed}>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {allowed.map((n) => { const P = L[n.el]; return <Route key={n.to} path={n.to} element={<P />} />; })}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
