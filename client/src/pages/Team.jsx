import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Badge } from '../components/ui.jsx';
const ROLES = ['manager', 'cashier', 'kitchen', 'waiter'];
export default function Team() {
  const { user } = useAuth(); const isOwner = user.role === 'owner';
  const [list, setList] = useState([]); const [err, setErr] = useState(''); const [act, setAct] = useState(null);
  const { register, handleSubmit, reset } = useForm({ defaultValues: { role: 'cashier' } });
  const load = () => api.get('/users').then((r) => setList(r.data)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, []);
  const run = async (fn) => { try { setErr(''); await fn(); load(); } catch (e) { setErr(errMsg(e)); } };
  const add = handleSubmit((v) => run(async () => { await api.post('/users', v); reset(); }));
  return (
    <div className="page"><div className="page-head"><h1 className="serif">Team</h1></div><Alert error={err} />
      {isOwner && <form className="card form-row" onSubmit={add}><input required placeholder="Full name" {...register('name')} /><input required type="email" placeholder="Email" {...register('email')} /><input required type="password" minLength={8} placeholder="Temporary password (8+)" {...register('password')} />
        <select {...register('role')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select><button className="btn">Add staff</button></form>}
      <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>
        {list.map((u) => <tr key={u._id}><td data-label="Name">{u.name}</td><td data-label="Email">{u.email}</td>
          <td data-label="Role">{isOwner && u.role !== 'owner' ? <select value={u.role} onChange={(e) => run(() => api.patch(`/users/${u._id}`, { role: e.target.value }))} aria-label="Role">{ROLES.map((r) => <option key={r}>{r}</option>)}</select> : <span className="capitalize">{u.role}</span>}</td>
          <td data-label="Status"><Badge status={u.active ? 'available' : 'cancelled'} /></td>
          <td className="actions"><button className="btn btn--ghost" onClick={async () => setAct({ u, ...(await api.get(`/users/${u._id}/activity`)).data })}>Activity</button>
            {isOwner && u.role !== 'owner' && <button className="btn btn--ghost" onClick={() => run(() => api.patch(`/users/${u._id}`, { active: !u.active }))}>{u.active ? 'Deactivate' : 'Activate'}</button>}</td></tr>)}</tbody></table></div>
      {act && <div className="modal-wrap" role="dialog" aria-modal="true"><div className="modal"><h3>{act.u.name} — activity</h3><p className="muted">{act.ordersCreated} orders created</p>
        {act.logs.length === 0 ? <p className="muted">No audited actions yet.</p> : <ul className="plain-list">{act.logs.map((l) => <li key={l._id}><span>{l.action}</span><span className="muted small">{new Date(l.createdAt).toLocaleString()}</span></li>)}</ul>}
        <div className="modal__actions"><button className="btn btn--ghost" onClick={() => setAct(null)}>Close</button></div></div></div>}
    </div>
  );
}
