import { useEffect, useState } from 'react';
import { api, errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Badge, Empty, Receipt } from '../components/ui.jsx';
const NEXT = { served: 'completed' };
export default function Orders() {
  const { money, user, restaurant } = useAuth();
  const [f, setF] = useState({ q: '', status: '', type: '', paymentStatus: '', page: 1 });
  const [res, setRes] = useState({ data: [], pages: 1 }); const [err, setErr] = useState(''); const [rc, setRc] = useState(null);
  const load = () => api.get('/orders', { params: Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }).then((r) => setRes(r.data)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, [f]); // eslint-disable-line
  const act = async (fn) => { try { setErr(''); await fn(); load(); } catch (e) { setErr(errMsg(e)); } };
  const mgr = ['owner', 'manager'].includes(user.role);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, page: 1 });
  const refund = (o) => { const amt = window.prompt('Refund amount', o.total); const reason = amt && window.prompt('Reason for refund'); if (reason) act(() => api.post(`/orders/${o._id}/refunds`, { amount: +amt, reason })); };
  const cancel = (o) => { const reason = window.prompt('Reason for cancelling'); if (reason) act(() => api.post(`/orders/${o._id}/cancel`, { reason })); };
  return (
    <div className="page"><div className="page-head"><h1 className="serif">Orders</h1></div><Alert error={err} />
      <div className="card form-row"><input placeholder="Order #" value={f.q} onChange={set('q')} aria-label="Order number" />
        <select value={f.status} onChange={set('status')} aria-label="Status"><option value="">Any status</option>{['confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'].map((s) => <option key={s}>{s}</option>)}</select>
        <select value={f.type} onChange={set('type')} aria-label="Type"><option value="">Any type</option>{['dine-in', 'takeaway', 'delivery'].map((s) => <option key={s}>{s}</option>)}</select>
        <select value={f.paymentStatus} onChange={set('paymentStatus')} aria-label="Payment"><option value="">Any payment</option>{['unpaid', 'paid', 'partially_refunded', 'refunded'].map((s) => <option key={s}>{s}</option>)}</select></div>
      {res.data.length === 0 ? <Empty title="No orders match" /> : <div className="table-wrap"><table className="table"><thead><tr><th>#</th><th>Time</th><th>Type</th><th>Total</th><th>Status</th><th>Payment</th><th></th></tr></thead><tbody>
        {res.data.map((o) => <tr key={o._id}><td data-label="#">{o.number}</td><td data-label="Time">{new Date(o.createdAt).toLocaleString()}</td><td data-label="Type">{o.type}{o.table ? ` · T${o.table.number}` : ''}</td><td data-label="Total" className="num">{money(o.total)}</td><td data-label="Status"><Badge status={o.status} /></td><td data-label="Payment"><Badge status={o.paymentStatus} /></td>
          <td className="actions"><button className="btn btn--ghost" onClick={() => setRc(o)}>Receipt</button>
            {NEXT[o.status] && o.paymentStatus !== 'unpaid' && <button className="btn btn--ghost" onClick={() => act(() => api.patch(`/orders/${o._id}/status`, { status: NEXT[o.status] }))}>Complete</button>}
            {o.paymentStatus === 'unpaid' && !['cancelled', 'completed'].includes(o.status) && <button className="btn btn--ghost" onClick={() => act(() => api.post(`/orders/${o._id}/payments`, { method: 'cash' }))}>Take cash</button>}
            {o.paymentStatus === 'unpaid' && o.status !== 'cancelled' && <button className="btn btn--ghost" onClick={() => cancel(o)}>Cancel</button>}
            {mgr && ['paid', 'partially_refunded'].includes(o.paymentStatus) && <button className="btn btn--ghost" onClick={() => refund(o)}>Refund</button>}</td></tr>)}
      </tbody></table></div>}
      <div className="pager"><button className="btn btn--ghost" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })}>Prev</button><span>Page {f.page} / {res.pages || 1}</span><button className="btn btn--ghost" disabled={f.page >= res.pages} onClick={() => setF({ ...f, page: f.page + 1 })}>Next</button></div>
      {rc && <Receipt order={rc} restaurant={restaurant} money={money} onClose={() => setRc(null)} />}
    </div>
  );
}
