import { useCallback, useEffect, useState } from 'react';
import { api, errMsg, connectSocket } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Empty, minutesSince } from '../components/ui.jsx';
import '../styles/kitchen.css';
const COLS = [['confirmed', 'New', 'preparing', 'Start'], ['preparing', 'Preparing', 'ready', 'Mark ready'], ['ready', 'Ready', 'served', 'Served']];
export default function Kitchen() {
  const { restaurant, user } = useAuth();
  const [orders, setOrders] = useState([]); const [err, setErr] = useState(''); const [, tick] = useState(0);
  const load = useCallback(() => api.get('/orders/active').then((r) => setOrders(r.data)).catch((e) => setErr(errMsg(e))), []);
  useEffect(() => {
    load(); const s = connectSocket();
    s.on('order:update', load); s.on('connect', load); // reload authoritative state on (re)connect
    const t = setInterval(() => tick((x) => x + 1), 30000);
    return () => { s.close(); clearInterval(t); };
  }, [load]);
  const move = async (id, status) => { try { await api.patch(`/orders/${id}/status`, { status }); load(); } catch (e) { setErr(errMsg(e)); } };
  const canServe = user.role !== 'kitchen';
  return (
    <div className="kitchen-page"><Alert error={err} />
      <div className="kitchen-board">{COLS.map(([st, label, next, action]) => {
        const list = orders.filter((o) => o.status === st);
        return (<section className="kitchen-col" key={st}><h2>{label} <span className="count">{list.length}</span></h2>
          {list.length === 0 && <Empty title="Nothing here" />}
          {list.map((o) => { const m = minutesSince(o.createdAt); const late = st !== 'ready' && m > restaurant.prepTargetMinutes;
            return (<article key={o._id} className={`kitchen-order-card ${late ? 'kitchen-order-card--late' : ''}`}>
              <header><strong>#{o.number}</strong><span>{o.type === 'dine-in' ? `Table ${o.table?.number ?? '?'}` : o.type}</span><span className="num">{m} min{late ? ' · LATE' : ''}</span></header>
              <ul>{o.items.map((i, k) => <li key={k}><b>{i.qty}×</b> {i.name}{i.station && i.station !== 'kitchen' && <em> [{i.station}]</em>}{i.notes && <div className="note">Note: {i.notes}</div>}</li>)}</ul>
              {o.notes && <p className="note">Order note: {o.notes}</p>}
              {(next !== 'served' || canServe) && <button className="btn btn--block" onClick={() => move(o._id, next)}>{action}</button>}
            </article>); })}
        </section>);
      })}</div>
    </div>
  );
}
