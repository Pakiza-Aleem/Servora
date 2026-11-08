import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import * as Icons from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { api, connectSocket } from '../api.js';
import { notifActions } from '../app/store.js';
export default function Layout({ nav, children }) {
  const { user, restaurant, logout } = useAuth();
  const [open, setOpen] = useState(false); const [bell, setBell] = useState(false); const [branch, setBranch] = useState('');
  const dispatch = useDispatch(); const list = useSelector((s) => s.notifications.list);
  useEffect(() => {
    api.get('/notifications').then((r) => dispatch(notifActions.setAll(r.data))).catch(() => {});
    api.get('/branches').then((r) => setBranch(r.data[0]?.name || '')).catch(() => {});
    const s = connectSocket(); s.on('notification', (n) => dispatch(notifActions.push(n))); return () => s.close();
  }, [dispatch]);
  const unread = list.filter((n) => !n.read).length;
  const toggleBell = () => { setBell(!bell); if (!bell && unread) { api.post('/notifications/read-all'); setTimeout(() => dispatch(notifActions.readAll()), 1500); } };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="brand"><span className="brand__mark">S</span><span className="brand__word">SERVORA</span></div>
        <nav className="sidebar__nav" onClick={() => setOpen(false)}>
          {nav.map((n) => { const I = Icons[n.icon]; return <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav-link"><I size={18} />{n.label}</NavLink>; })}
        </nav>
        <div className="sidebar__user">
          <div><strong>{user.name}</strong><span className="muted capitalize">{user.role}</span></div>
          <button className="btn btn--ghost btn--icon" onClick={logout} aria-label="Log out"><Icons.LogOut size={18} /></button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="btn btn--ghost btn--icon menu-toggle" onClick={() => setOpen(true)} aria-label="Open menu"><Icons.Menu size={20} /></button>
          <span className="topbar__restaurant">{restaurant?.name}{branch && ` · ${branch}`}</span>
          <div className="bell">
            <button className="btn btn--ghost btn--icon" onClick={toggleBell} aria-label={`Notifications, ${unread} unread`}><Icons.Bell size={18} />{unread > 0 && <span className="bell__dot">{unread}</span>}</button>
            {bell && <div className="bell__panel card">{list.length === 0 ? <p className="muted">No notifications</p> : list.map((n) => <div key={n._id} className={`bell__item ${n.read ? '' : 'bell__item--new'}`}><strong>{n.title}</strong><span className="muted small">{n.body}</span></div>)}</div>}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
