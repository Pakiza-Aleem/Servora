import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Empty } from '../components/ui.jsx';
export default function Customers() {
  const { money } = useAuth();
  const [list, setList] = useState([]); const [err, setErr] = useState(''); const [detail, setDetail] = useState(null); const [q, setQ] = useState('');
  const { register, handleSubmit, reset } = useForm();
  const load = () => api.get('/customers').then((r) => setList(r.data)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, []);
  const add = handleSubmit(async (v) => { try { setErr(''); await api.post('/customers', v); reset(); load(); } catch (e) { setErr(errMsg(e)); } });
  const open = async (c) => setDetail((await api.get(`/customers/${c._id}`)).data);
  const shown = list.filter((c) => (c.name + (c.phone || '')).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page"><div className="page-head"><h1 className="serif">Customers</h1><input placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" /></div><Alert error={err} />
      <form className="card form-row" onSubmit={add}><input required placeholder="Name" {...register('name')} /><input placeholder="Phone (optional)" {...register('phone')} /><input type="email" placeholder="Email (optional)" {...register('email')} /><button className="btn">Add customer</button></form>
      {shown.length === 0 ? <Empty title="No customers yet" hint="Walk-in orders don’t need a customer record." /> : <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Loyalty points</th><th></th></tr></thead><tbody>
        {shown.map((c) => <tr key={c._id}><td data-label="Name">{c.name}</td><td data-label="Phone">{c.phone}</td><td data-label="Email">{c.email}</td><td data-label="Points" className="num">{c.points}</td><td><button className="btn btn--ghost" onClick={() => open(c)}>History</button></td></tr>)}</tbody></table></div>}
      {detail && <div className="modal-wrap" role="dialog" aria-modal="true"><div className="modal"><h3>{detail.name}</h3><p className="muted">Total completed purchases: <strong className="num">{money(detail.totalSpent)}</strong> · {detail.points} points</p>
        {detail.orders.length === 0 ? <Empty title="No purchases yet" /> : <ul className="plain-list">{detail.orders.map((o) => <li key={o._id}><span>#{o.number} · {new Date(o.createdAt).toLocaleDateString()} · {o.paymentStatus}</span><strong className="num">{money(o.total)}</strong></li>)}</ul>}
        <div className="modal__actions"><button className="btn btn--ghost" onClick={() => setDetail(null)}>Close</button></div></div></div>}
    </div>
  );
}
